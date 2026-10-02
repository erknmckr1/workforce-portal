import { Request, Response } from "express";
import { Operator, Role, Section, Department, JobTitle, LeaveRecord, LeaveActivityLog, SystemAuditLog } from "../models";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const ROLE_PERSONEL = 1;
const ROLE_YONETICI = 2;
const ROLE_MUDUR = 3;
const ROLE_USTABASI = 9;

const resolveApprovalChain = (operator: Operator, dept?: Department | null, section?: Section | null) => {
    const roleId = Number(operator.role_id);
    const operatorId = operator.id_dec;
    const departmentUstabasi = dept?.ustabasi_id || null;
    const departmentSupervisor = dept?.supervisor_id || null;
    const sectionManager = section?.manager_id || null;
    const isSectionManager = sectionManager === operatorId; // Ilgılını bölümün müdürü mü izin alıyor ?
    const isDepartmentSupervisor = departmentSupervisor === operatorId; // Bölüm yöneticisi mi izin alıyor ?
    const isDepartmentUstabasi = departmentUstabasi === operatorId; // Usta başı mı izin alıyor ?

    if (isSectionManager || roleId === ROLE_MUDUR) {
        return {
            auth1: null,
            auth2: null
        };
    }

    if (isDepartmentSupervisor || roleId === ROLE_YONETICI) {
        return {
            auth1: sectionManager,
            auth2: null
        };
    }

    if (isDepartmentUstabasi || roleId === ROLE_USTABASI) {
        return {
            auth1: departmentSupervisor,
            auth2: sectionManager
        };
    }

    if (roleId === ROLE_PERSONEL || roleId > 0) {
        const firstApprover = departmentUstabasi || departmentSupervisor || sectionManager;
        const secondApprover = (departmentUstabasi && departmentSupervisor)
            ? departmentSupervisor
            : (firstApprover !== sectionManager ? sectionManager : null);

        return {
            auth1: firstApprover || null,
            auth2: secondApprover || null
        };
    }

    return {
        auth1: operator.auth1 || null,
        auth2: operator.auth2 || null
    };
};

const syncOperatorApprovalChains = async (where: any = {}) => {
    const operators = await Operator.findAll({
        where: { is_active: 1, ...where }
    });

    if (!operators.length) return 0;

    const departments = await Department.findAll();
    const sections = await Section.findAll();
    const departmentMap = new Map(departments.map(dept => [Number(dept.id), dept]));
    const sectionMap = new Map(sections.map(section => [Number(section.id), section]));

    let updateCount = 0;
    for (const operator of operators) {
        const dept = operator.department ? departmentMap.get(Number(operator.department)) : null;
        const sectionId = dept?.section_id || operator.section;
        const section = sectionId ? sectionMap.get(Number(sectionId)) : null;
        const nextApproval = resolveApprovalChain(operator, dept, section);

        if ((operator.auth1 || null) !== nextApproval.auth1 || (operator.auth2 || null) !== nextApproval.auth2) {
            await operator.update(nextApproval);
            updateCount++;
        }
    }

    return updateCount;
};

const syncDepartmentApprovalChains = async (departmentId: string | number) => {
    return syncOperatorApprovalChains({ department: departmentId });
};

const syncSectionApprovalChains = async (sectionId: string | number) => {
    const departments = await Department.findAll({ where: { section_id: sectionId } });
    const departmentIds = departments.map(dept => dept.id);

    return syncOperatorApprovalChains({
        [Op.or]: [
            { section: sectionId },
            ...(departmentIds.length ? [{ department: { [Op.in]: departmentIds } }] : [])
        ]
    });
};

/**
 * Birim Sorumlusu veya Ustabaşı değiştiğinde o birimdeki personellerin
 * sadece bekleyen (leave_status_id IN (1, 2)) izinlerini yeni onaycıya aktarır.
 * Geçmişteki onaylı/reddedilmiş/iptal edilmiş izinlere KESİNLİKLE dokunmaz.
 */
const syncDepartmentPendingLeaves = async (
    departmentId: string | number,
    oldApproverId: string | null | undefined,
    newApproverId: string | null | undefined,
    level: 1 | 2,
    performedBy?: string
) => {
    if (!oldApproverId || oldApproverId === newApproverId) return 0;

    try {
        const deptOperators = await Operator.findAll({
            where: { department: departmentId },
            attributes: ["id_dec"]
        });
        const opIds = deptOperators.map(o => o.id_dec);
        if (!opIds.length) return 0;

        const approverCol = level === 1 ? "auth1_user_id" : "auth2_user_id";
        const pendingLeaves = await LeaveRecord.findAll({
            where: {
                user_id: { [Op.in]: opIds },
                leave_status_id: level,
                [approverCol]: oldApproverId
            }
        });

        if (!pendingLeaves.length) return 0;

        for (const leave of pendingLeaves) {
            await leave.update({ [approverCol]: newApproverId || null });
            await LeaveActivityLog.create({
                leave_record_id: leave.id,
                performed_by: performedBy || "SYSTEM",
                action: "APPROVER_REASSIGNED",
                new_status_id: level,
                details: `Organizasyonel onaycı değişikliği nedeniyle ${level}. onaycı aktarıldı (${oldApproverId} -> ${newApproverId || "Atanmadı"}).`
            }).catch(e => console.warn("Activity log hatası:", e));
        }

        return pendingLeaves.length;
    } catch (err) {
        console.error("syncDepartmentPendingLeaves Hatası:", err);
        return 0;
    }
};

/**
 * Bölüm Müdürü değiştiğinde o bölümdeki (ve bağlı birimlerdeki) personellerin
 * sadece bekleyen (leave_status_id IN (1, 2)) izinlerini yeni müdüre aktarır.
 */
const syncSectionPendingLeaves = async (
    sectionId: string | number,
    oldManagerId: string | null | undefined,
    newManagerId: string | null | undefined,
    performedBy?: string
) => {
    if (!oldManagerId || oldManagerId === newManagerId) return 0;

    try {
        const departments = await Department.findAll({ where: { section_id: sectionId }, attributes: ["id"] });
        const deptIds = departments.map(d => d.id);

        const secOperators = await Operator.findAll({
            where: {
                [Op.or]: [
                    { section: sectionId },
                    ...(deptIds.length ? [{ department: { [Op.in]: deptIds } }] : [])
                ]
            },
            attributes: ["id_dec"]
        });
        const opIds = secOperators.map(o => o.id_dec);
        if (!opIds.length) return 0;

        // Hem 2. onay bekleyenler (status: 2) hem de 1. onaycının doğrudan müdür olduğu izinler (status: 1)
        const pendingLeavesAuth2 = await LeaveRecord.findAll({
            where: {
                user_id: { [Op.in]: opIds },
                leave_status_id: 2,
                auth2_user_id: oldManagerId
            }
        });

        const pendingLeavesAuth1 = await LeaveRecord.findAll({
            where: {
                user_id: { [Op.in]: opIds },
                leave_status_id: 1,
                auth1_user_id: oldManagerId
            }
        });

        let updatedCount = 0;

        for (const leave of pendingLeavesAuth2) {
            await leave.update({ auth2_user_id: newManagerId || null });
            await LeaveActivityLog.create({
                leave_record_id: leave.id,
                performed_by: performedBy || "SYSTEM",
                action: "APPROVER_REASSIGNED",
                new_status_id: 2,
                details: `Bölüm müdürü değişikliği nedeniyle 2. onaycı aktarıldı (${oldManagerId} -> ${newManagerId || "Atanmadı"}).`
            }).catch(e => console.warn("Activity log hatası:", e));
            updatedCount++;
        }

        for (const leave of pendingLeavesAuth1) {
            await leave.update({ auth1_user_id: newManagerId || null });
            await LeaveActivityLog.create({
                leave_record_id: leave.id,
                performed_by: performedBy || "SYSTEM",
                action: "APPROVER_REASSIGNED",
                new_status_id: 1,
                details: `Bölüm müdürü değişikliği nedeniyle 1. onaycı aktarıldı (${oldManagerId} -> ${newManagerId || "Atanmadı"}).`
            }).catch(e => console.warn("Activity log hatası:", e));
            updatedCount++;
        }

        return updatedCount;
    } catch (err) {
        console.error("syncSectionPendingLeaves Hatası:", err);
        return 0;
    }
};

/**
 * Organizasyonel hiyerarşi ve birim/bölüm değişikliklerini system_audit_logs tablosuna kaydeder.
 */
const logHierarchyAudit = async (
    req: Request,
    actionType: string,
    description: string,
    details?: any
) => {
    try {
        const user = (req as any).user;
        const operatorId = user?.id_dec || "SYSTEM";
        const operatorName = user ? `${user.name || ""} ${user.surname || ""}`.trim() || user.id_dec : "Sistem";
        const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || null;

        await SystemAuditLog.create({
            operator_id: operatorId,
            operator_name: operatorName,
            module: "ORGANIZATION_HIERARCHY",
            action_type: actionType,
            description,
            details: details ? JSON.stringify(details) : null,
            ip_address: clientIp
        });
    } catch (err) {
        console.warn("SystemAuditLog kaydı oluşturulamadı:", err);
    }
};

// Gelen base64 resmi masaüstü klasörüne kaydeder ve dosya adını döner
const savePhotoToDisk = (photoData: string, personnelId: string): string | null => {
    try {
        if (!photoData || !photoData.startsWith("data:image")) return null;
        
        const matches = photoData.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;
        
        let ext = matches[1];
        if (ext === 'jpeg') ext = 'jpg';
        
        const photoBuffer = Buffer.from(matches[2], 'base64');
        const fileName = `${personnelId}_${Date.now()}.${ext}`;
        
        const saveDir = process.env.PHOTO_STORAGE_PATH || 'C:\\Users\\ecakir\\Desktop\\PersonelFotograflari';
        
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        
        const filePath = path.join(saveDir, fileName);
        fs.writeFileSync(filePath, photoBuffer);
        
        return fileName;
    } catch (err) {
        console.error("Fotoğraf kaydedilemedi:", err);
        return null;
    }
};

// Tüm aktif personeli getir (is_active = 1) - Sayfalama ve Arama Desteği ile
export const getAllPersonnel = async (req: Request, res: Response): Promise<Response> => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const isApprover = req.query.isApprover === "true";
        const search = (req.query.search as string) || "";
        const offset = (page - 1) * limit;

        const whereCondition: any = { is_active: 1 };
        const roleWhere: any = {};

        if (isApprover) {
            roleWhere.name = { [Op.or]: [
                { [Op.like]: "%Müdür%" },
                { [Op.like]: "%Yönetici%" },
                { [Op.like]: "%Ustabasi%" },
                { [Op.like]: "%Ustabaşı%" },
                { [Op.like]: "%Admin%" },
                { [Op.like]: "%İK%" }
            ] };
        }

        // Arama filtresi (İsim, Soyisim, ID_DEC)
        if (search) {
            whereCondition[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { surname: { [Op.like]: `%${search}%` } },
                { id_dec: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows: personnel } = await Operator.findAndCountAll({
            where: whereCondition,
            include: [
                { 
                    model: Role, 
                    attributes: ["id", "name"],
                    where: Object.keys(roleWhere).length > 0 ? roleWhere : undefined
                },
                { model: Section, attributes: ["id", "name"] },
                { model: Department, attributes: ["id", "name"] },
                { model: JobTitle, attributes: ["id", "name"] },
                { model: Operator, as: "Auth1", attributes: ["name", "surname"] },
                { model: Operator, as: "Auth2", attributes: ["name", "surname"] }
            ],
            attributes: { exclude: ["op_password"] },
            order: [["name", "ASC"]],
            limit: limit,
            offset: offset
        });

        return res.status(200).json({
            data: personnel,
            total: count,
            page: page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error("GetAllPersonnel Hatası:", error);
        return res.status(500).json({ message: "Personel listesi çekilirken hata oluştu." });
    }
};

// Yeni personel oluştur
export const createPersonnel = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { 
            id_dec, id_hex, name, surname, nick_name, short_name, 
            password, email, gender, address, role_id, 
            section, department, title, leave_balance, route, stop_name,
            auth1, auth2, photo_data, tc_no, external_id
        } = req.body;

        // Gerekli alan kontrolü
        if (!id_dec || !id_hex || !name || !surname || !role_id) {
            return res.status(400).json({ message: "Zorunlu alanlar eksik (ID, İsim, Soyisim, Rol)." });
        }

        // Mevcut kullanıcı kontrolü
        const existing = await Operator.findOne({ where: { [Op.or]: [{ id_dec }, { id_hex }] } });
        if (existing) {
            return res.status(400).json({ message: "Bu ID (Dec veya Hex) zaten kullanımda." });
        }

        // Şifre hash'leme
        const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash("123456", 10);

        // Fotoğraf Kaydetme
        let finalPhotoName = null;
        if (photo_data) {
            finalPhotoName = savePhotoToDisk(photo_data, id_dec);
        }

        const newOperator = await Operator.create({
            id_dec,
            id_hex,
            name,
            surname,
            nick_name: nick_name || null,
            short_name: short_name || null,
            op_password: hashedPassword,
            email: email || null,
            gender: gender || null,
            address: address || null,
            role_id,
            section: section || null,
            department: department || null,
            title: title || null,
            auth1: auth1 || null,
            auth2: auth2 || null,
            leave_balance: leave_balance || 0,
            route: route || null,
            stop_name: stop_name || null,
            photo_url: finalPhotoName,
            is_active: 1,
            tc_no: tc_no || null,
            external_id: external_id || null
        });

        // Eğer auth1 ve auth2 belirtilmemişse, birim/bölümden onaycıları otomatik ata
        if (!auth1 && !auth2 && (department || section)) {
            try {
                const deptId = department ? Number(department) : null;
                const dept = deptId ? await Department.findByPk(deptId) : null;
                const sectionId = dept?.section_id || (section ? Number(section) : null);
                const sectionModel = sectionId ? await Section.findByPk(sectionId) : null;
                const autoApproval = resolveApprovalChain(newOperator, dept, sectionModel);
                if (autoApproval.auth1 || autoApproval.auth2) {
                    await newOperator.update(autoApproval);
                }
            } catch (autoErr) {
                console.warn("CreatePersonnel onay zinciri otomatik tamamlama atlandı:", autoErr);
            }
        }

        return res.status(201).json({ message: "Personel başarıyla oluşturuldu.", id: newOperator.id_dec });
    } catch (error) {
        console.error("CreatePersonnel Hatası:", error);
        return res.status(500).json({ message: "Personel oluşturulurken hata oluştu." });
    }
};

// Personel güncelle
export const updatePersonnel = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id_dec } = req.params;
        const updateData = { ...req.body };

        const operator = await Operator.findByPk(id_dec as string);
        if (!operator) {
            return res.status(404).json({ message: "Personel bulunamadı." });
        }

        // Şifre güncellemesi kontrolü ve sanal (virtual) alanları temizleme
        if (updateData.password) {
            updateData.op_password = await bcrypt.hash(updateData.password, 10);
        }
        // password kolonu DB'de yok, op_password var. Error vermemesi için uçur:
        delete updateData.password;
        
        // Güvenlik ve çakışma riski için kritik verilerin (Birincil Anahtar) güncellenmesini engelle
        delete updateData.id_dec;
        delete updateData.id_hex;

        // Fotoğraf Güncelleme
        if (updateData.photo_data) {
            const savedName = savePhotoToDisk(updateData.photo_data, id_dec as string);
            if (savedName) updateData.photo_url = savedName;
            delete updateData.photo_data;
        } else if (updateData.photo_data === null) {
            updateData.photo_url = null; // Fotoğrafı silmişse
            delete updateData.photo_data;
        }

        // SQL Server (Tedious) hatalarını (özellikle Foreign Key) engellemek için boş stringleri null'a çeviriyoruz
        for (const key in updateData) {
            if (updateData[key] === "") {
                updateData[key] = null;
            }
        }

        const oldDepartment = operator.department;
        const oldSection = operator.section;

        await operator.update(updateData);

        // Eğer birim, bölüm veya rol değiştiyse onay hiyerarşisini otomatik yeniden hesapla
        if (
            updateData.department !== undefined ||
            updateData.section !== undefined ||
            updateData.role_id !== undefined
        ) {
            try {
                // 1. Personelin kendi onaycılarını güncelle
                const deptId = operator.department ? Number(operator.department) : null;
                const dept = deptId ? await Department.findByPk(deptId) : null;
                const sectionId = dept?.section_id || (operator.section ? Number(operator.section) : null);
                const sectionModel = sectionId ? await Section.findByPk(sectionId) : null;
                const nextApproval = resolveApprovalChain(operator, dept, sectionModel);

                if (
                    (operator.auth1 || null) !== nextApproval.auth1 ||
                    (operator.auth2 || null) !== nextApproval.auth2
                ) {
                    await operator.update(nextApproval);
                }

                // 2. Eğer personel eski biriminden başka birime taşındıysa ve eski birimde yönetici idiyse, eski birimi güncelle
                if (oldDepartment && String(oldDepartment) !== String(operator.department)) {
                    const oldDept = await Department.findByPk(Number(oldDepartment));
                    if (oldDept) {
                        const deptUpdates: any = {};
                        if (oldDept.supervisor_id === id_dec) deptUpdates.supervisor_id = null;
                        if (oldDept.ustabasi_id === id_dec) deptUpdates.ustabasi_id = null;
                        if (Object.keys(deptUpdates).length > 0) {
                            await oldDept.update(deptUpdates);
                            await syncDepartmentApprovalChains(Number(oldDepartment));
                        }
                    }
                }

                // 3. Eğer personel eski bölümünden başka bölüme taşındıysa ve eski bölümde müdür idiyse, eski bölümü güncelle
                if (oldSection && String(oldSection) !== String(operator.section)) {
                    const oldSec = await Section.findByPk(Number(oldSection));
                    if (oldSec && oldSec.manager_id === id_dec) {
                        await oldSec.update({ manager_id: null });
                        await syncSectionApprovalChains(Number(oldSection));
                    }
                }
            } catch (syncErr) {
                console.warn("UpdatePersonnel sırasında onay zinciri senkronizasyonu atlandı:", syncErr);
            }
        }

        return res.status(200).json({ message: "Personel bilgileri güncellendi." });
    } catch (error) {
        console.error("UpdatePersonnel Hatası:", error);
        return res.status(500).json({ message: "Güncelleme sırasında hata oluştu." });
    }
};

// Soft delete (is_active = 2)
export const deletePersonnel = async (req: Request, res: Response): Promise<Response> => {
    try {
        const rawId = req.params.id_dec;
        const id_dec = String(Array.isArray(rawId) ? rawId[0] : rawId);

        const operator = await Operator.findByPk(id_dec);
        if (!operator) {
            return res.status(404).json({ message: "Personel bulunamadı." });
        }

        // 1. Personeli pasif duruma getir
        await operator.update({ is_active: 0 });

        // 2. Bu personelin kendi bekleyen (status: 1 veya 2) izinleri varsa iptal et
        try {
            const selfPendingLeaves = await LeaveRecord.findAll({
                where: {
                    user_id: id_dec,
                    leave_status_id: { [Op.in]: [1, 2] }
                }
            });
            for (const leave of selfPendingLeaves) {
                await leave.update({ leave_status_id: 5 }); // 5: İptal Edildi
                await LeaveActivityLog.create({
                    leave_record_id: leave.id,
                    performed_by: (req as any).user?.id_dec || "SYSTEM",
                    action: "CANCELLED",
                    new_status_id: 5,
                    details: "Personel işten ayrıldığı / pasife alındığı için bekleyen izin talebi otomatik iptal edildi."
                }).catch(e => console.warn("Activity log hatası:", e));
            }
        } catch (selfLeaveErr) {
            console.warn("Ayrılan personelin bekleyen izinleri iptal edilirken hata:", selfLeaveErr);
        }

        // 3. Bu personel Birim Sorumlusu veya Ustabaşı mıydı?
        try {
            const supervisedDepts = await Department.findAll({
                where: {
                    [Op.or]: [
                        { supervisor_id: id_dec },
                        { ustabasi_id: id_dec }
                    ]
                }
            });

            for (const dept of supervisedDepts) {
                const wasSupervisor = dept.supervisor_id === id_dec;
                const wasUstabasi = dept.ustabasi_id === id_dec;

                await dept.update({
                    supervisor_id: wasSupervisor ? null : dept.supervisor_id,
                    ustabasi_id: wasUstabasi ? null : dept.ustabasi_id
                });

                // Birimdeki personellerin hiyerarşisini yeniden senkronize et
                await syncDepartmentApprovalChains(dept.id);

                // Bu birimde ayrılan yöneticinin onayını bekleyen izinleri üst amire aktar
                const section = dept.section_id ? await Section.findByPk(dept.section_id) : null;
                const fallbackApprover = wasUstabasi ? dept.supervisor_id : section?.manager_id;

                if (fallbackApprover) {
                    await syncDepartmentPendingLeaves(dept.id, id_dec, fallbackApprover, 1, (req as any).user?.id_dec);
                    await syncDepartmentPendingLeaves(dept.id, id_dec, fallbackApprover, 2, (req as any).user?.id_dec);
                }
            }
        } catch (deptErr) {
            console.warn("Ayrılan personelin birim yöneticilikleri temizlenirken hata:", deptErr);
        }

        // 4. Bu personel Bölüm Müdürü müydü?
        try {
            const managedSections = await Section.findAll({ where: { manager_id: id_dec } });
            for (const sec of managedSections) {
                await sec.update({ manager_id: null });
                await syncSectionApprovalChains(sec.id);
            }
        } catch (secErr) {
            console.warn("Ayrılan personelin bölüm müdürlükleri temizlenirken hata:", secErr);
        }

        // 5. Hala bu kişiyi auth1 veya auth2 olarak gösteren aktif personel kaldıysa güvenle temizle
        try {
            const remainingReferencing = await Operator.findAll({
                where: {
                    is_active: 1,
                    [Op.or]: [{ auth1: id_dec }, { auth2: id_dec }]
                }
            });

            if (remainingReferencing.length > 0) {
                for (const refOp of remainingReferencing) {
                    const deptId = refOp.department ? Number(refOp.department) : null;
                    const dept = deptId ? await Department.findByPk(deptId) : null;
                    const secId = dept?.section_id || (refOp.section ? Number(refOp.section) : null);
                    const sec = secId ? await Section.findByPk(secId) : null;
                    const resolved = resolveApprovalChain(refOp, dept, sec);
                    await refOp.update(resolved);
                }
            }
        } catch (refErr) {
            console.warn("Kalan onaycı referansları temizlenirken hata:", refErr);
        }

        return res.status(200).json({ message: "Personel pasif duruma getirildi ve hiyerarşi güvenle güncellendi." });
    } catch (error) {
        console.error("DeletePersonnel Hatası:", error);
        return res.status(500).json({ message: "Silme işlemi sırasında hata oluştu." });
    }
};

// Yardımcı lookupları getir
export const getPersonnelLookups = async (req: Request, res: Response): Promise<Response> => {
    try {
        const roles = await Role.findAll();
        const sections = await Section.findAll();
        const departments = await Department.findAll();
        const titles = await JobTitle.findAll();

        return res.status(200).json({
            roles,
            sections,
            departments,
            titles
        });
    } catch (error) {
        console.error("GetLookups Hatası:", error);
        return res.status(500).json({ message: "Lookup verileri çekilirken hata oluştu." });
    }
};

// Bölüm Yöneticisini (manager_id) Güncelle (2. Onaycı)
export const updateSectionManager = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { manager_id } = req.body;
        
        const section = await Section.findByPk(id as string);
        if (!section) return res.status(404).json({ message: "Bölüm (Section) bulunamadı." });
        
        const oldManagerId = section.manager_id;
        await section.update({ manager_id: manager_id || null });
        
        const updateCount = await syncSectionApprovalChains(String(id));
        
        // Bekleyen izinleri yeni müdüre aktar
        let reassignedCount = 0;
        if (oldManagerId && oldManagerId !== (manager_id || null)) {
            reassignedCount = await syncSectionPendingLeaves(
                String(id),
                oldManagerId,
                manager_id || null,
                (req as any).user?.id_dec
            );
        }

        // SystemAuditLog
        let managerName = null;
        if (manager_id) {
            const op = await Operator.findByPk(manager_id);
            managerName = op ? `${op.name} ${op.surname}` : manager_id;
        }
        await logHierarchyAudit(
            req,
            manager_id ? "SECTION_MANAGER_ASSIGNED" : "SECTION_MANAGER_REMOVED",
            manager_id
                ? `'${section.name}' bölümüne '${managerName}' Bölüm Müdürü olarak atandı.`
                : `'${section.name}' bölümünün Bölüm Müdürü kaldırıldı.`,
            { sectionId: id, sectionName: section.name, manager_id, oldManagerId, updateCount, reassignedLeavesCount: reassignedCount }
        );
        
        return res.status(200).json({
            message: `Bölüm yöneticisi atandı, ${updateCount} personelin onay zinciri ve ${reassignedCount} bekleyen izin aktarıldı.`
        });
    } catch(err) {
        console.error("UpdateSectionManager Hatası:", err);
        return res.status(500).json({ message: "Bölüm yöneticisi atanırken hata oluştu" });
    }
};

// Birim Sorumlusunu (supervisor_id) Güncelle (1. Onaycı)
export const updateDepartmentSupervisor = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { supervisor_id } = req.body;
        
        const dept = await Department.findByPk(id as string);
        if (!dept) return res.status(404).json({ message: "Birim (Department) bulunamadı." });
        
        const oldSupervisorId = dept.supervisor_id;
        await dept.update({ supervisor_id: supervisor_id || null });
        
        const updateCount = await syncDepartmentApprovalChains(String(id));
        
        // Bekleyen izinleri yeni birim sorumlusuna aktar
        let reassignedCount = 0;
        if (oldSupervisorId && oldSupervisorId !== (supervisor_id || null)) {
            const r1 = await syncDepartmentPendingLeaves(
                String(id),
                oldSupervisorId,
                supervisor_id || null,
                1,
                (req as any).user?.id_dec
            );
            const r2 = await syncDepartmentPendingLeaves(
                String(id),
                oldSupervisorId,
                supervisor_id || null,
                2,
                (req as any).user?.id_dec
            );
            reassignedCount = r1 + r2;
        }

        // SystemAuditLog
        let supervisorName = null;
        if (supervisor_id) {
            const op = await Operator.findByPk(supervisor_id);
            supervisorName = op ? `${op.name} ${op.surname}` : supervisor_id;
        }
        await logHierarchyAudit(
            req,
            supervisor_id ? "DEPARTMENT_SUPERVISOR_ASSIGNED" : "DEPARTMENT_SUPERVISOR_REMOVED",
            supervisor_id
                ? `'${dept.name}' birimine '${supervisorName}' Birim Yöneticisi olarak atandı.`
                : `'${dept.name}' biriminin Birim Yöneticisi kaldırıldı.`,
            { departmentId: id, departmentName: dept.name, supervisor_id, oldSupervisorId, updateCount, reassignedLeavesCount: reassignedCount }
        );
        
        return res.status(200).json({
            message: `Birim sorumlusu atandı, ${updateCount} personelin onay zinciri ve ${reassignedCount} bekleyen izin aktarıldı.`
        });
    } catch(err) {
        console.error("UpdateDepartmentSupervisor Hatası:", err);
        return res.status(500).json({ message: "Birim sorumlusu atanırken hata oluştu" });
    }
};

// Tüm Onaycı Yetkilerini Yeniden Senkronize Et
export const updateDepartmentUstabasi = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { ustabasi_id } = req.body;

        const dept = await Department.findByPk(id as string);
        if (!dept) return res.status(404).json({ message: "Birim (Department) bulunamadı." });

        const oldUstabasiId = dept.ustabasi_id;
        await dept.update({ ustabasi_id: ustabasi_id || null });

        const updateCount = await syncDepartmentApprovalChains(String(id));

        // Bekleyen izinleri yeni ustabaşına aktar
        let reassignedCount = 0;
        if (oldUstabasiId && oldUstabasiId !== (ustabasi_id || null)) {
            reassignedCount = await syncDepartmentPendingLeaves(
                String(id),
                oldUstabasiId,
                ustabasi_id || null,
                1,
                (req as any).user?.id_dec
            );
        }

        // SystemAuditLog
        let ustabasiName = null;
        if (ustabasi_id) {
            const op = await Operator.findByPk(ustabasi_id);
            ustabasiName = op ? `${op.name} ${op.surname}` : ustabasi_id;
        }
        await logHierarchyAudit(
            req,
            ustabasi_id ? "DEPARTMENT_USTABASI_ASSIGNED" : "DEPARTMENT_USTABASI_REMOVED",
            ustabasi_id
                ? `'${dept.name}' birimine '${ustabasiName}' Ustabaşı olarak atandı.`
                : `'${dept.name}' biriminin Ustabaşısı kaldırıldı.`,
            { departmentId: id, departmentName: dept.name, ustabasi_id, oldUstabasiId, updateCount, reassignedLeavesCount: reassignedCount }
        );

        return res.status(200).json({
            message: `Birim ustabaşısı atandı, ${updateCount} personelin onay zinciri ve ${reassignedCount} bekleyen izin aktarıldı.`
        });
    } catch(err) {
        console.error("UpdateDepartmentUstabasi Hatası:", err);
        return res.status(500).json({ message: "Birim ustabaşısı atanırken hata oluştu" });
    }
};

export const syncAllApprovals = async (req: Request, res: Response): Promise<Response> => {
    try {
        const updateCount = await syncOperatorApprovalChains();
        
        await logHierarchyAudit(
            req,
            "ALL_APPROVALS_SYNCED",
            `Tüm sistem yetki hiyerarşisi başarıyla senkronize edildi (${updateCount} personel güncellendi).`,
            { updatedPersonnelCount: updateCount }
        );

        return res.status(200).json({ message: `Tüm sistem yetki hiyerarşisi başarıyla senkronize edildi. Güncellenen personel: ${updateCount}` });
    } catch(err) {
        console.error("SyncAllApprovals Hatası:", err);
        return res.status(500).json({ message: "Senkronizasyon işlemi sırasında hata oluştu" });
    }
};

// Excel'den toplu izin bakiyesi güncelle
export const syncLeaveBalances = async (req: Request, res: Response): Promise<Response> => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Lütfen bir Excel dosyası yükleyin." });
        }

        // --- ARŞİVLEME İŞLEMİ ---
        // Masaüstünde bir klasör oluşturup dosyayı oraya yedekleyelim
        const desktopDir = path.join(process.env.USERPROFILE || 'C:', 'Desktop', 'Yuklenen_Izin_Dosyalari');
        if (!fs.existsSync(desktopDir)) {
            fs.mkdirSync(desktopDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `izin_guncelleme_${timestamp}.xlsx`;
        const archivePath = path.join(desktopDir, fileName);
        
        // Dosyayı diske yaz
        fs.writeFileSync(archivePath, req.file.buffer);
        // -------------------------

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        let updateCount = 0;
        let notFoundCount = 0;
        let unchangedCount = 0;

        for (const row of rows) {
            const excelTc = String(row["TC NO"] || "").trim();
            const excelBalance = parseFloat(row["KALAN İZİN"] || "0");

            if (!excelTc) continue;

            const operator = await Operator.findOne({ where: { tc_no: excelTc } });

            if (operator) {
                if (Number(operator.leave_balance) !== excelBalance) {
                    await operator.update({ leave_balance: excelBalance });
                    updateCount++;
                } else {
                    unchangedCount++;
                }
            } else {
                notFoundCount++;
            }
        }

        return res.status(200).json({
            message: "İşlem tamamlandı.",
            summary: {
                totalRows: rows.length,
                updated: updateCount,
                notFound: notFoundCount,
                unchanged: unchangedCount
            }
        });
    } catch (error) {
        console.error("SyncLeaveBalances Hatası:", error);
        return res.status(500).json({ message: "Excel işlenirken bir hata oluştu." });
    }
};

// Sunucu üzerindeki sabit dosyadan izin bakiyesi senkronize et
export const syncLeaveBalancesLocal = async (req: Request, res: Response): Promise<Response> => {
    try {
        const filePath = process.env.LEAVE_EXCEL_PATH || 'C:\\Users\\ecakir\\Desktop\\yillik_izin_takip_2025.xlsx';
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: `Belirtilen konumda dosya bulunamadı: ${filePath}` });
        }

        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        let updateCount = 0;
        let notFoundCount = 0;
        let unchangedCount = 0;

        for (const row of rows) {
            const excelTc = String(row["TC NO"] || "").trim();
            const excelBalance = parseFloat(row["KALAN İZİN"] || "0");

            if (!excelTc) continue;

            const operator = await Operator.findOne({ where: { tc_no: excelTc } });

            if (operator) {
                if (Number(operator.leave_balance) !== excelBalance) {
                    await operator.update({ leave_balance: excelBalance });
                    updateCount++;
                } else {
                    unchangedCount++;
                }
            } else {
                notFoundCount++;
            }
        }

        return res.status(200).json({
            message: "Sunucu dosyasından senkronizasyon tamamlandı.",
            summary: {
                totalRows: rows.length,
                updated: updateCount,
                notFound: notFoundCount,
                unchanged: unchangedCount,
                path: filePath
            }
        });
    } catch (error) {
        console.error("SyncLeaveBalancesLocal Hatası:", error);
        return res.status(500).json({ message: "Dosya okunurken bir hata oluştu." });
    }
};

// --- BÖLÜM (SECTION) YÖNETİMİ ---

// Yeni Bölüm Ekle
export const createSection = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { name, manager_id } = req.body;
        if (!name) {
            return res.status(400).json({ message: "Bölüm adı zorunludur." });
        }

        const section = await Section.create({
            name,
            manager_id: manager_id || null,
            is_active: true
        });

        await logHierarchyAudit(
            req,
            "SECTION_CREATED",
            `'${name}' isimli yeni bölüm oluşturuldu.`,
            { sectionId: section.id, name, manager_id }
        );

        return res.status(201).json({ message: "Bölüm başarıyla oluşturuldu.", data: section });
    } catch (error) {
        console.error("CreateSection Hatası:", error);
        return res.status(500).json({ message: "Bölüm oluşturulurken hata oluştu." });
    }
};

// Bölüm Güncelle
export const updateSection = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { name, manager_id, is_active } = req.body;

        const sectionId = parseInt(id as string, 10);
        const section = await Section.findByPk(sectionId);
        if (!section) {
            return res.status(404).json({ message: "Bölüm bulunamadı." });
        }

        const oldManagerId = section.manager_id;
        const isDeactivating = is_active !== undefined && is_active === false && section.is_active !== false;
        const isActivating = is_active !== undefined && is_active === true && section.is_active === false;

        await section.update({
            name: name !== undefined ? name : section.name,
            manager_id: manager_id !== undefined ? (manager_id || null) : section.manager_id,
            is_active: is_active !== undefined ? is_active : section.is_active
        });

        // Eğer onaycı değiştiyse ilgili kişilerin onay zincirlerini tetikle
        if (manager_id !== undefined) {
            await syncSectionApprovalChains(sectionId);
            if (oldManagerId && oldManagerId !== (manager_id || null)) {
                await syncSectionPendingLeaves(sectionId, oldManagerId, manager_id || null, (req as any).user?.id_dec);
            }
        }

        // SystemAuditLog
        let auditAction = "SECTION_UPDATED";
        let auditDesc = `'${section.name}' bölüm bilgileri güncellendi.`;
        if (isDeactivating) {
            auditAction = "SECTION_DEACTIVATED";
            auditDesc = `'${section.name}' bölümü pasife alındı.`;
        } else if (isActivating) {
            auditAction = "SECTION_ACTIVATED";
            auditDesc = `'${section.name}' bölümü yeniden aktif hale getirildi.`;
        }

        await logHierarchyAudit(req, auditAction, auditDesc, {
            sectionId,
            name: section.name,
            manager_id,
            is_active
        });

        return res.status(200).json({ message: "Bölüm başarıyla güncellendi.", data: section });
    } catch (error) {
        console.error("UpdateSection Hatası:", error);
        return res.status(500).json({ message: "Bölüm güncellenirken hata oluştu." });
    }
};

// --- BİRİM (DEPARTMENT) YÖNETİMİ ---

// Yeni Birim Ekle
export const createDepartment = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { name, section_id, supervisor_id, ustabasi_id } = req.body;
        if (!name || !section_id) {
            return res.status(400).json({ message: "Birim adı ve Bölüm seçimi zorunludur." });
        }

        const department = await Department.create({
            name,
            section_id: Number(section_id),
            supervisor_id: supervisor_id || null,
            ustabasi_id: ustabasi_id || null,
            is_active: true
        });

        await logHierarchyAudit(
            req,
            "DEPARTMENT_CREATED",
            `'${name}' isimli yeni birim oluşturuldu.`,
            { departmentId: department.id, name, section_id, supervisor_id, ustabasi_id }
        );

        return res.status(201).json({ message: "Birim başarıyla oluşturuldu.", data: department });
    } catch (error) {
        console.error("CreateDepartment Hatası:", error);
        return res.status(500).json({ message: "Birim oluşturulurken hata oluştu." });
    }
};

// Birimdeki Aktif Personel Sayısını Getir
export const getDepartmentActivePersonnelCount = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const count = await Operator.count({
            where: { department: id, is_active: 1 }
        });
        return res.status(200).json({ count });
    } catch (error) {
        console.error("GetDepartmentActivePersonnelCount Hatası:", error);
        return res.status(500).json({ message: "Personel sayısı alınırken hata oluştu." });
    }
};

// Birim Güncelle
export const updateDepartment = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { name, section_id, supervisor_id, ustabasi_id, is_active, deactivation_action, target_department_id } = req.body;

        const departmentId = parseInt(id as string, 10);
        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({ message: "Birim bulunamadı." });
        }

        const oldSupervisorId = department.supervisor_id;
        const oldUstabasiId = department.ustabasi_id;
        const oldSectionId = department.section_id;

        // Pasife alma kontrolü (Aktif birim pasife alınıyorsa)
        const isDeactivating = is_active !== undefined && is_active === false && department.is_active !== false;
        if (isDeactivating) {
            const activeOperators = await Operator.findAll({
                where: { department: departmentId, is_active: 1 }
            });

            if (activeOperators.length > 0) {
                if (!deactivation_action) {
                    return res.status(400).json({
                        message: `Bu birimde ${activeOperators.length} adet aktif personel bulunmaktadır. Lütfen bir aksiyon seçiniz.`,
                        requires_action: true,
                        active_count: activeOperators.length
                    });
                }

                if (deactivation_action === "transfer") {
                    if (!target_department_id) {
                        return res.status(400).json({ message: "Personellerin aktarılacağı hedef birim seçilmelidir." });
                    }
                    const targetDept = await Department.findByPk(Number(target_department_id));
                    if (!targetDept || !targetDept.is_active) {
                        return res.status(400).json({ message: "Seçilen hedef birim bulunamadı veya pasif durumda." });
                    }

                    const targetDeptId = Number(target_department_id);
                    const targetSectionId = targetDept.section_id || null;

                    // A) Personelleri hedef birime ve o birimin bölümüne taşı
                    await Operator.update(
                        { department: targetDeptId, section: targetSectionId },
                        { where: { department: departmentId, is_active: 1 } }
                    );

                    // B) Hedef birimdeki personellerin onay zincirlerini güncelle
                    await syncDepartmentApprovalChains(targetDeptId);

                    // C) Bekleyen izinleri yeni onaycılara aktar
                    const newSupervisorId = targetDept.supervisor_id;
                    const newUstabasiId = targetDept.ustabasi_id;

                    if (oldSupervisorId && oldSupervisorId !== newSupervisorId) {
                        await syncDepartmentPendingLeaves(targetDeptId, oldSupervisorId, newSupervisorId || null, 1, (req as any).user?.id_dec);
                    }
                    if (oldUstabasiId && oldUstabasiId !== newUstabasiId) {
                        await syncDepartmentPendingLeaves(targetDeptId, oldUstabasiId, newUstabasiId || null, 1, (req as any).user?.id_dec);
                    }
                    if (department.section_id && targetDept.section_id && Number(department.section_id) !== Number(targetDept.section_id)) {
                        const oldSec = await Section.findByPk(Number(department.section_id));
                        const newSec = await Section.findByPk(Number(targetDept.section_id));
                        if (oldSec?.manager_id && oldSec.manager_id !== newSec?.manager_id) {
                            await syncDepartmentPendingLeaves(targetDeptId, oldSec.manager_id, newSec?.manager_id || null, 2, (req as any).user?.id_dec);
                        }
                    }

                    // SystemAuditLog: Birim pasife alındı ve personeller başka birime aktarıldı
                    await logHierarchyAudit(
                        req,
                        "DEPARTMENT_DEACTIVATED_TRANSFER",
                        `'${department.name}' birimi pasife alındı ve içerisindeki ${activeOperators.length} personel '${targetDept.name}' birimine aktarıldı.`,
                        {
                            departmentId,
                            departmentName: department.name,
                            targetDepartmentId: targetDeptId,
                            targetDepartmentName: targetDept.name,
                            affectedPersonnelCount: activeOperators.length,
                            affectedPersonnelIds: activeOperators.map(o => o.id_dec)
                        }
                    );
                } else if (deactivation_action === "pool") {
                    // Personelleri birimsiz havuzda tut (department: null, section korunur)
                    const currentSectionId = department.section_id;
                    const sec = currentSectionId ? await Section.findByPk(Number(currentSectionId)) : null;
                    const managerId = sec?.manager_id || null;

                    // Operatörlerin birimini null yap
                    await Operator.update(
                        { department: null },
                        { where: { department: departmentId, is_active: 1 } }
                    );

                    // Bölüm içi onay zincirlerini senkronize et (birimsiz oldukları için auth1/auth2 bölüm müdürüne bağlanır)
                    if (currentSectionId) {
                        await syncSectionApprovalChains(currentSectionId);
                    }

                    // Bekleyen izinleri Bölüm Müdürüne aktar
                    if (managerId) {
                        const opIds = activeOperators.map(o => o.id_dec);
                        if (department.supervisor_id && department.supervisor_id !== managerId) {
                            const pendingLeaves = await LeaveRecord.findAll({
                                where: {
                                    user_id: { [Op.in]: opIds },
                                    leave_status_id: 1,
                                    auth1_user_id: department.supervisor_id
                                }
                            });
                            for (const leave of pendingLeaves) {
                                await leave.update({ auth1_user_id: managerId });
                                await LeaveActivityLog.create({
                                    leave_record_id: leave.id,
                                    performed_by: (req as any).user?.id_dec || "SYSTEM",
                                    action: "APPROVER_REASSIGNED",
                                    new_status_id: 1,
                                    details: `Birim pasife alınıp personeller havuzlandı: 1. Onaycı ${department.supervisor_id} -> Bölüm Müdürü ${managerId} olarak güncellendi.`
                                }).catch(e => console.warn("Activity log hatası:", e));
                            }
                        }
                        if (department.ustabasi_id && department.ustabasi_id !== managerId) {
                            const pendingLeaves = await LeaveRecord.findAll({
                                where: {
                                    user_id: { [Op.in]: opIds },
                                    leave_status_id: 1,
                                    auth1_user_id: department.ustabasi_id
                                }
                            });
                            for (const leave of pendingLeaves) {
                                await leave.update({ auth1_user_id: managerId });
                                await LeaveActivityLog.create({
                                    leave_record_id: leave.id,
                                    performed_by: (req as any).user?.id_dec || "SYSTEM",
                                    action: "APPROVER_REASSIGNED",
                                    new_status_id: 1,
                                    details: `Birim pasife alınıp personeller havuzlandı: 1. Onaycı (Ustabaşı) ${department.ustabasi_id} -> Bölüm Müdürü ${managerId} olarak güncellendi.`
                                }).catch(e => console.warn("Activity log hatası:", e));
                            }
                        }
                    }

                    // SystemAuditLog: Birim pasife alındı ve personeller havuza alındı
                    await logHierarchyAudit(
                        req,
                        "DEPARTMENT_DEACTIVATED_POOL",
                        `'${department.name}' birimi pasife alındı ve içerisindeki ${activeOperators.length} personel bölümsel havuza alındı (Onaylar Bölüm Müdürüne devredildi).`,
                        {
                            departmentId,
                            departmentName: department.name,
                            sectionId: currentSectionId,
                            affectedPersonnelCount: activeOperators.length,
                            affectedPersonnelIds: activeOperators.map(o => o.id_dec)
                        }
                    );
                }
            } else {
                // İçeride aktif çalışan olmayan birim pasife alındı
                await logHierarchyAudit(
                    req,
                    "DEPARTMENT_DEACTIVATED",
                    `'${department.name}' birimi pasife alındı (Birimde kayıtlı aktif personel bulunmuyor).`,
                    { departmentId, departmentName: department.name }
                );
            }
        }

        const isActivating = is_active !== undefined && is_active === true && department.is_active === false;
        if (isActivating) {
            await logHierarchyAudit(
                req,
                "DEPARTMENT_ACTIVATED",
                `'${department.name}' birimi yeniden aktif hale getirildi.`,
                { departmentId, departmentName: department.name }
            );
        }

        await department.update({
            name: name !== undefined ? name : department.name,
            section_id: section_id !== undefined ? Number(section_id) : department.section_id,
            supervisor_id: supervisor_id !== undefined ? (supervisor_id || null) : department.supervisor_id,
            ustabasi_id: ustabasi_id !== undefined ? (ustabasi_id || null) : department.ustabasi_id,
            is_active: is_active !== undefined ? is_active : department.is_active
        });

        // 1. Senaryo: Birim başka bir bölüme taşındıysa (section_id değiştiyse ve pasifleşmediyse)
        const isSectionChanged = !isDeactivating && section_id !== undefined && oldSectionId !== null && Number(section_id) !== Number(oldSectionId);
        if (isSectionChanged) {
            const newSectionId = Number(section_id);

            // A) Bu birime kayıtlı tüm personellerin bölüm (section) bilgisini otomatik yeni bölüme taşı
            await Operator.update(
                { section: newSectionId },
                { where: { department: departmentId } }
            );

            // B) Birimdeki personellerin onay zincirini (özellikle 2. onaycı / yeni bölüm müdürü) senkronize et
            await syncDepartmentApprovalChains(departmentId);

            // C) Eğer eski bölüm müdürü ile yeni bölüm müdürü farklıysa, bekleyen izinleri yeni müdüre aktar
            const oldSec = oldSectionId ? await Section.findByPk(Number(oldSectionId)) : null;
            const newSec = await Section.findByPk(newSectionId);
            const oldManagerId = oldSec?.manager_id;
            const newManagerId = newSec?.manager_id;

            if (oldManagerId && oldManagerId !== newManagerId) {
                await syncDepartmentPendingLeaves(departmentId, oldManagerId, newManagerId, 2, (req as any).user?.id_dec);
                await syncDepartmentPendingLeaves(departmentId, oldManagerId, newManagerId, 1, (req as any).user?.id_dec);
            }

            // SystemAuditLog: Birim başka bölüme taşındı
            const oldSecName = oldSec?.name || "Bölümsüz";
            const newSecName = newSec?.name || "Yeni Bölüm";
            await logHierarchyAudit(
                req,
                "DEPARTMENT_SECTION_TRANSFERRED",
                `'${department.name}' birimi '${oldSecName}' bölümünden '${newSecName}' bölümüne taşındı.`,
                {
                    departmentId,
                    departmentName: department.name,
                    oldSectionId,
                    oldSectionName: oldSecName,
                    newSectionId,
                    newSectionName: newSecName
                }
            );
        }

        // Onay zincirini senkronize et (supervisor veya ustabasi değiştiyse)
        if (!isDeactivating && (supervisor_id !== undefined || ustabasi_id !== undefined)) {
            await syncDepartmentApprovalChains(departmentId);
            if (supervisor_id !== undefined && oldSupervisorId && oldSupervisorId !== (supervisor_id || null)) {
                await syncDepartmentPendingLeaves(departmentId, oldSupervisorId, supervisor_id || null, 1, (req as any).user?.id_dec);
                await syncDepartmentPendingLeaves(departmentId, oldSupervisorId, supervisor_id || null, 2, (req as any).user?.id_dec);
            }
            if (ustabasi_id !== undefined && oldUstabasiId && oldUstabasiId !== (ustabasi_id || null)) {
                await syncDepartmentPendingLeaves(departmentId, oldUstabasiId, ustabasi_id || null, 1, (req as any).user?.id_dec);
            }
        }

        return res.status(200).json({ message: "Birim başarıyla güncellendi.", data: department });
    } catch (error) {
        console.error("UpdateDepartment Hatası:", error);
        return res.status(500).json({ message: "Birim güncellenirken hata oluştu." });
    }
};
