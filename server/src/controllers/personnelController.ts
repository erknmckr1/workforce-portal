import { Request, Response } from "express";
import { Operator, Role, Section, Department, JobTitle } from "../models";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

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
                { [Op.like]: "%Şef%" },
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
            auth1, auth2, photo_data
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
            is_active: 1
        });

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

        await operator.update(updateData);

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
        const sections = await Section.findAll({ where: { is_active: true } });
        const departments = await Department.findAll({ where: { is_active: true } });
        const titles = await JobTitle.findAll({ where: { is_active: true } });

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
        
        await section.update({ manager_id: manager_id || null });
        
        // Operatör tablosunu güncelle (auth2)
        await Operator.update(
            { auth2: manager_id || null },
            { where: { section: id, is_active: 1 } }
        );
        
        return res.status(200).json({ message: "Bölüm yöneticisi atandı ve bağlı personeller güncellendi." });
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
        
        await dept.update({ supervisor_id: supervisor_id || null });
        
        // Operatör tablosunu güncelle (auth1)
        await Operator.update(
            { auth1: supervisor_id || null },
            { where: { department: id, is_active: 1 } }
        );
        
        return res.status(200).json({ message: "Birim sorumlusu atandı ve bağlı personeller güncellendi." });
    } catch(err) {
        console.error("UpdateDepartmentSupervisor Hatası:", err);
        return res.status(500).json({ message: "Birim sorumlusu atanırken hata oluştu" });
    }
};

// Tüm Onaycı Yetkilerini Yeniden Senkronize Et
export const syncAllApprovals = async (req: Request, res: Response): Promise<Response> => {
    try {
        const sections = await Section.findAll();
        for (const sec of sections) {
            await Operator.update({ auth2: sec.manager_id || null }, { where: { section: sec.id, is_active: 1 } });
        }
        
        const depts = await Department.findAll();
        for (const dept of depts) {
            await Operator.update({ auth1: dept.supervisor_id || null }, { where: { department: dept.id, is_active: 1 } });
        }
        
        return res.status(200).json({ message: "Tüm sistem yetki hiyerarşisi personellere başarıyla senkronize edildi." });
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
        const desktopDir = path.join('C:', 'Users', 'ecakir', 'Desktop', 'Yuklenen_Izin_Dosyalari');
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
