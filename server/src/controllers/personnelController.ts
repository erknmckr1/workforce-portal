import { Request, Response } from "express";
import { Operator, Role, Section, Department, JobTitle, SystemAuditLog } from "../models";
import {
    logApprovalHierarchyChange,
    fetchApproverName,
    logPersonnelCreate,
    logPersonnelUpdate,
    logPersonnelDelete
} from "../services/auditService";
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
        return {
            auth1: departmentUstabasi || departmentSupervisor,
            auth2: departmentUstabasi && departmentSupervisor ? departmentSupervisor : sectionManager
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

        // Denetim loguna kaydet
        await logPersonnelCreate(req, newOperator);

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

        const oldAuth1 = operator.auth1;
        const oldAuth2 = operator.auth2;
        const isAuth1Changed = updateData.auth1 !== undefined && (updateData.auth1 || null) !== (oldAuth1 || null);
        const isAuth2Changed = updateData.auth2 !== undefined && (updateData.auth2 || null) !== (oldAuth2 || null);

        // Değişiklikleri karşılaştırmak için mevcut durumun anlık görüntüsü
        const oldSnapshot = { ...operator.get() };

        await operator.update(updateData);

        // Eğer onaycılar doğrudan değiştirildiyse onay hiyerarşisi loguna kaydet
        if (isAuth1Changed || isAuth2Changed) {
            const [oldAuth1Name, newAuth1Name, oldAuth2Name, newAuth2Name] = await Promise.all([
                fetchApproverName(oldAuth1),
                fetchApproverName(updateData.auth1),
                fetchApproverName(oldAuth2),
                fetchApproverName(updateData.auth2),
            ]);

            const notesArr: string[] = [];
            if (isAuth1Changed) {
                notesArr.push(`1. Onaycı: ${oldAuth1Name || oldAuth1 || "Yok"} ➔ ${newAuth1Name || updateData.auth1 || "Yok"}`);
            }
            if (isAuth2Changed) {
                notesArr.push(`2. Onaycı: ${oldAuth2Name || oldAuth2 || "Yok"} ➔ ${newAuth2Name || updateData.auth2 || "Yok"}`);
            }

            await logApprovalHierarchyChange({
                req,
                actionType: "UPDATE_OPERATOR_AUTH",
                targetType: "OPERATOR",
                targetId: operator.id_dec,
                targetName: `${operator.name} ${operator.surname}`,
                notes: notesArr.join(", "),
                affectedCount: 1,
            });
        }

        // Personel profil alanı değişikliklerini denetim loguna kaydet
        await logPersonnelUpdate(
            req,
            operator.id_dec,
            oldSnapshot,
            updateData,
            `${operator.name} ${operator.surname}`
        );

        return res.status(200).json({ message: "Personel bilgileri güncellendi." });
    } catch (error) {
        console.error("UpdatePersonnel Hatası:", error);
        return res.status(500).json({ message: "Güncelleme sırasında hata oluştu." });
    }
};

// Soft delete (is_active = 2)
export const deletePersonnel = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id_dec } = req.params;

        const operator = await Operator.findByPk(id_dec as string);
        if (!operator) {
            return res.status(404).json({ message: "Personel bulunamadı." });
        }

        await operator.update({ is_active: 0 });

        // Denetim loguna kaydet
        await logPersonnelDelete(req, operator);

        return res.status(200).json({ message: "Personel pasif duruma getirildi (Soft-Delete)." });
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
        const [oldManagerName, newManagerName] = await Promise.all([
            fetchApproverName(oldManagerId),
            fetchApproverName(manager_id)
        ]);
        
        await section.update({ manager_id: manager_id || null });
        
        const updateCount = await syncSectionApprovalChains(String(id));

        // Denetim loguna kaydet
        await logApprovalHierarchyChange({
            req,
            actionType: "UPDATE_MANAGER",
            targetType: "SECTION",
            targetId: section.id,
            targetName: section.name,
            oldApproverId: oldManagerId,
            oldApproverName: oldManagerName,
            newApproverId: manager_id || null,
            newApproverName: newManagerName,
            affectedCount: updateCount
        });
        
        return res.status(200).json({ message: `Bölüm yöneticisi atandı ve ${updateCount} personelin onay zinciri güncellendi.` });
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
        const [oldSupervisorName, newSupervisorName] = await Promise.all([
            fetchApproverName(oldSupervisorId),
            fetchApproverName(supervisor_id)
        ]);
        
        await dept.update({ supervisor_id: supervisor_id || null });
        
        const updateCount = await syncDepartmentApprovalChains(String(id));

        // Denetim loguna kaydet
        await logApprovalHierarchyChange({
            req,
            actionType: "UPDATE_SUPERVISOR",
            targetType: "DEPARTMENT",
            targetId: dept.id,
            targetName: dept.name,
            oldApproverId: oldSupervisorId,
            oldApproverName: oldSupervisorName,
            newApproverId: supervisor_id || null,
            newApproverName: newSupervisorName,
            affectedCount: updateCount
        });
        
        return res.status(200).json({ message: `Birim sorumlusu atandı ve ${updateCount} personelin onay zinciri güncellendi.` });
    } catch(err) {
        console.error("UpdateDepartmentSupervisor Hatası:", err);
        return res.status(500).json({ message: "Birim sorumlusu atanırken hata oluştu" });
    }
};

// Birim Ustabaşısını Güncelle
export const updateDepartmentUstabasi = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { ustabasi_id } = req.body;

        const dept = await Department.findByPk(id as string);
        if (!dept) return res.status(404).json({ message: "Birim (Department) bulunamadı." });

        const oldUstabasiId = dept.ustabasi_id;
        const [oldUstabasiName, newUstabasiName] = await Promise.all([
            fetchApproverName(oldUstabasiId),
            fetchApproverName(ustabasi_id)
        ]);

        await dept.update({ ustabasi_id: ustabasi_id || null });

        const updateCount = await syncDepartmentApprovalChains(String(id));

        // Denetim loguna kaydet
        await logApprovalHierarchyChange({
            req,
            actionType: "UPDATE_USTABASI",
            targetType: "DEPARTMENT",
            targetId: dept.id,
            targetName: dept.name,
            oldApproverId: oldUstabasiId,
            oldApproverName: oldUstabasiName,
            newApproverId: ustabasi_id || null,
            newApproverName: newUstabasiName,
            affectedCount: updateCount
        });

        return res.status(200).json({ message: `Birim ustabaşısı atandı ve ${updateCount} personelin onay zinciri güncellendi.` });
    } catch(err) {
        console.error("UpdateDepartmentUstabasi Hatası:", err);
        return res.status(500).json({ message: "Birim ustabaşısı atanırken hata oluştu" });
    }
};

export const syncAllApprovals = async (req: Request, res: Response): Promise<Response> => {
    try {
        const updateCount = await syncOperatorApprovalChains();

        // Denetim loguna kaydet
        await logApprovalHierarchyChange({
            req,
            actionType: "SYNC_APPROVALS",
            targetType: "GLOBAL",
            targetId: 0,
            targetName: "Tüm Organizasyon",
            affectedCount: updateCount
        });
        
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
        const isManagerChanged = manager_id !== undefined && (manager_id || null) !== (oldManagerId || null);

        await section.update({
            name: name !== undefined ? name : section.name,
            manager_id: manager_id !== undefined ? (manager_id || null) : section.manager_id,
            is_active: is_active !== undefined ? is_active : section.is_active
        });

        // Eğer onaycı değiştiyse ilgili kişilerin onay zincirlerini tetikle ve logla
        if (isManagerChanged) {
            const updateCount = await syncSectionApprovalChains(sectionId);
            const [oldManagerName, newManagerName] = await Promise.all([
                fetchApproverName(oldManagerId),
                fetchApproverName(manager_id)
            ]);

            await logApprovalHierarchyChange({
                req,
                actionType: "UPDATE_MANAGER",
                targetType: "SECTION",
                targetId: section.id,
                targetName: section.name,
                oldApproverId: oldManagerId,
                oldApproverName: oldManagerName,
                newApproverId: manager_id || null,
                newApproverName: newManagerName,
                affectedCount: updateCount
            });
        }

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

        return res.status(201).json({ message: "Birim başarıyla oluşturuldu.", data: department });
    } catch (error) {
        console.error("CreateDepartment Hatası:", error);
        return res.status(500).json({ message: "Birim oluşturulurken hata oluştu." });
    }
};

// Birim Güncelle
export const updateDepartment = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { id } = req.params;
        const { name, section_id, supervisor_id, ustabasi_id, is_active } = req.body;

        const departmentId = parseInt(id as string, 10);
        const department = await Department.findByPk(departmentId);
        if (!department) {
            return res.status(404).json({ message: "Birim bulunamadı." });
        }

        const oldSupervisorId = department.supervisor_id;
        const oldUstabasiId = department.ustabasi_id;
        const isSupervisorChanged = supervisor_id !== undefined && (supervisor_id || null) !== (oldSupervisorId || null);
        const isUstabasiChanged = ustabasi_id !== undefined && (ustabasi_id || null) !== (oldUstabasiId || null);

        await department.update({
            name: name !== undefined ? name : department.name,
            section_id: section_id !== undefined ? Number(section_id) : department.section_id,
            supervisor_id: supervisor_id !== undefined ? (supervisor_id || null) : department.supervisor_id,
            ustabasi_id: ustabasi_id !== undefined ? (ustabasi_id || null) : department.ustabasi_id,
            is_active: is_active !== undefined ? is_active : department.is_active
        });

        // Onay zincirini senkronize et ve logla
        if (isSupervisorChanged || isUstabasiChanged) {
            const updateCount = await syncDepartmentApprovalChains(departmentId);

            if (isSupervisorChanged) {
                const [oldSupervisorName, newSupervisorName] = await Promise.all([
                    fetchApproverName(oldSupervisorId),
                    fetchApproverName(supervisor_id)
                ]);
                await logApprovalHierarchyChange({
                    req,
                    actionType: "UPDATE_SUPERVISOR",
                    targetType: "DEPARTMENT",
                    targetId: department.id,
                    targetName: department.name,
                    oldApproverId: oldSupervisorId,
                    oldApproverName: oldSupervisorName,
                    newApproverId: supervisor_id || null,
                    newApproverName: newSupervisorName,
                    affectedCount: updateCount
                });
            }

            if (isUstabasiChanged) {
                const [oldUstabasiName, newUstabasiName] = await Promise.all([
                    fetchApproverName(oldUstabasiId),
                    fetchApproverName(ustabasi_id)
                ]);
                await logApprovalHierarchyChange({
                    req,
                    actionType: "UPDATE_USTABASI",
                    targetType: "DEPARTMENT",
                    targetId: department.id,
                    targetName: department.name,
                    oldApproverId: oldUstabasiId,
                    oldApproverName: oldUstabasiName,
                    newApproverId: ustabasi_id || null,
                    newApproverName: newUstabasiName,
                    affectedCount: updateCount
                });
            }
        }

        return res.status(200).json({ message: "Birim başarıyla güncellendi.", data: department });
    } catch (error) {
        console.error("UpdateDepartment Hatası:", error);
        return res.status(500).json({ message: "Birim güncellenirken hata oluştu." });
    }
};

// Onay Hiyerarşisi Denetim Loglarını Getir
export const getApprovalAuditLogs = async (req: Request, res: Response): Promise<Response> => {
    try {
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
        const logs = await SystemAuditLog.findAll({
            where: { module: "APPROVAL_HIERARCHY" },
            order: [["createdAt", "DESC"]],
            limit
        });
        return res.status(200).json({ success: true, count: logs.length, logs });
    } catch (error) {
        console.error("getApprovalAuditLogs Hatası:", error);
        return res.status(500).json({ success: false, message: "Onay hiyerarşisi logları alınamadı." });
    }
};

// Genel / Modüle Göre Denetim Loglarını Getir
export const getSystemAuditLogs = async (req: Request, res: Response): Promise<Response> => {
    try {
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
        const moduleName = req.query.module ? String(req.query.module) : undefined;
        const whereCondition: any = {};
        if (moduleName) {
            whereCondition.module = moduleName;
        }

        const logs = await SystemAuditLog.findAll({
            where: whereCondition,
            order: [["createdAt", "DESC"]],
            limit
        });
        return res.status(200).json({ success: true, count: logs.length, logs });
    } catch (error) {
        console.error("getSystemAuditLogs Hatası:", error);
        return res.status(500).json({ success: false, message: "Denetim logları alınamadı." });
    }
};
