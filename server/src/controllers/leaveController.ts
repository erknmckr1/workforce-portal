import { Request, Response } from "express";
import { Op } from "sequelize";
import {
    LeaveRecord,
    LeaveStatus,
    LeaveReason,
    LeaveDurationType,
    Operator,
    LeaveActivityLog
} from "../models";
import sequelize from "../config/database";

// İzin için gerekli lookup verilerini getir
export const getLeaveLookups = async (req: Request, res: Response): Promise<Response> => {
    try {
        let reasons = await LeaveReason.findAll({ where: { is_active: true } });
        let statuses = await LeaveStatus.findAll();
        let durationTypes = await LeaveDurationType.findAll();

        if (reasons.length === 0) {
            console.log("Lookups are empty. Seeding defaults...");
            // Fail-safe seeding for dev environment
            await LeaveStatus.bulkCreate([
                { id: 1, code: "PENDING_AUTH1", label: "1. Onaycı Bekleniyor" },
                { id: 2, code: "PENDING_AUTH2", label: "2. Onaycı Bekleniyor" },
                { id: 3, code: "APPROVED", label: "Onaylandı" },
                { id: 4, code: "CANCELLED", label: "İptal Edildi" },
                { id: 5, code: "REJECTED", label: "Reddedildi" },
            ], { ignoreDuplicates: true });

            await LeaveDurationType.bulkCreate([
                { id: 1, code: "FULL_DAY", label: "Tam Gün", deduction_factor: 1.00 },
                { id: 2, code: "HALF_DAY_AM", label: "Yarım Gün (Sabah)", deduction_factor: 0.50 },
                { id: 3, code: "HALF_DAY_PM", label: "Yarım Gün (Öğleden Sonra)", deduction_factor: 0.50 },
                { id: 4, code: "HOURLY", label: "Saatlik İzin", deduction_factor: 0.00 },
            ], { ignoreDuplicates: true });

            await LeaveReason.bulkCreate([
                { id: 1, code: "ANNUAL", label: "Yıllık İzin", required_permission: null },
                { id: 2, code: "EXCUSE", label: "Mazeret İzni", required_permission: null },
                { id: 3, code: "REST", label: "İstirahat Raporu", required_permission: "leave.view_doctor_reasons" },
                { id: 4, code: "DOCTOR", label: "Doktor Sevk", required_permission: "leave.view_doctor_reasons" },
                { id: 5, code: "PATERNITY", label: "Babalık İzni", required_permission: null },
                { id: 6, code: "MARRIAGE", label: "Evlilik İzni", required_permission: null },
                { id: 7, code: "BEREAVEMENT", label: "Vefat İzni", required_permission: null },
            ], { ignoreDuplicates: true });

            reasons = await LeaveReason.findAll({ where: { is_active: true } });
            statuses = await LeaveStatus.findAll();
            durationTypes = await LeaveDurationType.findAll();
        }

        console.log(`Leave Lookups fetched - Reasons: ${reasons.length}, Statuses: ${statuses.length}, Durations: ${durationTypes.length}`);

        return res.status(200).json({
            reasons,
            statuses,
            durationTypes
        });
    } catch (error) {
        console.error("GetLeaveLookups Hatası:", error);
        return res.status(500).json({ message: "İzin yardımcı verileri çekilirken hata oluştu." });
    }
};

// Yeni İzin Talebi Oluştur
export const createLeave = async (req: Request, res: Response): Promise<Response> => {
    const transaction = await sequelize.transaction();
    try {
        const {
            user_id,
            leave_reason_id,
            leave_duration_type_id,
            start_date,
            end_date,
            description,
            phone,
            address,
            total_days,
            total_hours
        } = req.body;

        // İşlemi yapan kullanıcı ID'si (Auth middleware'den gelmeli, şimdilik body'den veya manuel)
        const creator_id = req.body.creator_id || user_id;

        // 1. Hedef kullanıcının onaycılarını bul
        const targetUser = await Operator.findByPk(user_id);
        if (!targetUser) {
            await transaction.rollback();
            return res.status(404).json({ message: "Personel bulunamadı." });
        }

        const auth1 = targetUser.auth1;
        const auth2 = targetUser.auth2;

        if (!auth1) {
            await transaction.rollback();
            return res.status(400).json({ message: "Seçili personelin 1. onaycısı (Birim Şefi) atanmamış. Lütfen önce onay hiyerarşisini düzenleyin." });
        }

        // 2. İlk durumu belirle (Genelde PENDING_AUTH1 id=1)
        const initialStatus = 1;

        // 3. Kaydı oluştur
        const newLeave = await LeaveRecord.create({
            user_id,
            leave_reason_id,
            leave_status_id: initialStatus,
            leave_duration_type_id,
            auth1_user_id: auth1,
            auth2_user_id: auth2 || null,
            start_date,
            end_date,
            total_days: total_days || null,
            total_hours: total_hours || null,
            description: description || null,
            phone: phone || null,
            address: address || null,
            created_by: creator_id
        }, { transaction });

        // 4. Aktivite logu yaz
        await LeaveActivityLog.create({
            leave_record_id: (newLeave as any).id,
            performed_by: creator_id,
            action: creator_id === user_id ? "CREATED" : "CREATED_BY_HR",
            new_status_id: initialStatus,
            details: "İzin talebi oluşturuldu."
        }, { transaction });

        await transaction.commit();
        return res.status(201).json({ message: "İzin talebi başarıyla oluşturuldu.", data: newLeave });
    } catch (error) {
        await transaction.rollback();
        console.error("CreateLeave Hatası:", error);
        return res.status(500).json({ message: "İzin talebi oluşturulurken hata oluştu." });
    }
};

// İzinleri Listele (Filtreleme ile)
export const getLeaves = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { user_id, status_id, start_date, end_date, approver_id } = req.query;
        let where: any = {};

        if (approver_id) {
            where = {
                [Op.or]: [
                    { auth1_user_id: approver_id, leave_status_id: 1 },
                    { auth2_user_id: approver_id, leave_status_id: 2 }
                ]
            };
        } else {
            if (user_id) where.user_id = user_id;
            if (status_id) where.leave_status_id = status_id;
        }

        const leaves = await LeaveRecord.findAll({
            where,
            include: [
                { model: Operator, as: "User", attributes: ["name", "surname", "id_dec"] },
                { model: LeaveReason, attributes: ["label"] },
                { model: LeaveStatus, attributes: ["label", "code"] },
                { model: LeaveDurationType, attributes: ["label"] },
                { model: Operator, as: "Approver1", attributes: ["name", "surname"] },
                { model: Operator, as: "Approver2", attributes: ["name", "surname"] }
            ],
            order: [["created_at", "DESC"]]
        });

        return res.status(200).json(leaves);
    } catch (error) {
        console.error("GetLeaves Hatası:", error);
        return res.status(500).json({ message: "İzin kayıtları çekilirken hata oluştu." });
    }
};

// İzin Onayla
export const approveLeave = async (req: Request, res: Response): Promise<Response> => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { approver_id, notes } = req.body;

        const leave = await LeaveRecord.findByPk(id as string);
        if (!leave) {
            await transaction.rollback();
            return res.status(404).json({ message: "İzin talebi bulunamadı." });
        }

        let newStatus = 0;
        let actionEnum = "";

        const currentStatus = leave.getDataValue('leave_status_id') as number;
        
        if (currentStatus === 1) {
            if (leave.getDataValue('auth1_user_id') !== approver_id) {
                await transaction.rollback();
                return res.status(403).json({ message: "Bu izni onaylama yetkiniz yok (1. Onaycı değilsiniz)." });
            }
            newStatus = leave.getDataValue('auth2_user_id') ? 2 : 3;
            actionEnum = newStatus === 3 ? "APPROVED" : "APPROVED_STEP1";
        } else if (currentStatus === 2) {
            if (leave.getDataValue('auth2_user_id') !== approver_id) {
                await transaction.rollback();
                return res.status(403).json({ message: "Bu izni onaylama yetkiniz yok (2. Onaycı değilsiniz)." });
            }
            newStatus = 3;
            actionEnum = "APPROVED";
        } else {
            await transaction.rollback();
            return res.status(400).json({ message: "Bu izin talebi şu an onaylanabilir durumda değil." });
        }

        await leave.update({ leave_status_id: newStatus }, { transaction });

        await LeaveActivityLog.create({
            leave_record_id: leave.getDataValue('id'),
            performed_by: approver_id,
            action: actionEnum,
            new_status_id: newStatus,
            details: notes || "İzin onaylandı."
        }, { transaction });

        await transaction.commit();
        return res.status(200).json({ message: "İzin başarıyla onaylandı.", data: leave });
    } catch (error) {
        await transaction.rollback();
        console.error("ApproveLeave Error:", error);
        return res.status(500).json({ message: "İzin onaylanırken hata oluştu." });
    }
};

// İzin Reddet
export const rejectLeave = async (req: Request, res: Response): Promise<Response> => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { approver_id, notes } = req.body;

        // Status 5'in varlığından emin ol (önceden seedlenmemiş DB'ler için güvenli ağ)
        await LeaveStatus.findOrCreate({
            where: { id: 5 },
            defaults: { code: "REJECTED", label: "Reddedildi" },
            transaction
        });

        const leave = await LeaveRecord.findByPk(id as string);
        if (!leave) {
            await transaction.rollback();
            return res.status(404).json({ message: "İzin talebi bulunamadı." });
        }

        const currentStatus = leave.getDataValue('leave_status_id') as number;
        if (currentStatus !== 1 && currentStatus !== 2) {
            await transaction.rollback();
            return res.status(400).json({ message: "Bu izin talebi şu an reddedilebilir durumda değil." });
        }

        if (currentStatus === 1 && leave.getDataValue('auth1_user_id') !== approver_id) {
            await transaction.rollback();
            return res.status(403).json({ message: "Bu izni reddetme yetkiniz yok (1. Onaycı değilsiniz)." });
        }
        
        if (currentStatus === 2 && leave.getDataValue('auth2_user_id') !== approver_id) {
            await transaction.rollback();
            return res.status(403).json({ message: "Bu izni reddetme yetkiniz yok (2. Onaycı değilsiniz)." });
        }

        await leave.update({ leave_status_id: 5 }, { transaction });

        await LeaveActivityLog.create({
            leave_record_id: leave.getDataValue('id'),
            performed_by: approver_id,
            action: "REJECTED",
            new_status_id: 5,
            details: notes || "İzin Yönetici tarafından reddedildi."
        }, { transaction });

        await transaction.commit();
        return res.status(200).json({ message: "İzin başarıyla reddedildi.", data: leave });
    } catch (error) {
        await transaction.rollback();
        console.error("RejectLeave Error:", error);
        return res.status(500).json({ message: "İzin reddedilirken hata oluştu." });
    }
};

// İzin İptal Et (Personel Tarafı)
export const cancelLeave = async (req: Request, res: Response): Promise<Response> => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { user_id } = req.body; // İşlemi yapan kullanıcının ID'si

        const leave = await LeaveRecord.findByPk(id as string);
        if (!leave) {
            await transaction.rollback();
            return res.status(404).json({ message: "İzin talebi bulunamadı." });
        }

        // 1. Sadece sahibi iptal edebilir
        if (leave.getDataValue('user_id') !== user_id) {
            await transaction.rollback();
            return res.status(403).json({ message: "Bu izin talebini iptal etme yetkiniz yok." });
        }

        // 2. Sadece bekleyen (1 veya 2) durumdakiler iptal edilebilir
        const currentStatus = leave.getDataValue('leave_status_id') as number;
        if (currentStatus !== 1 && currentStatus !== 2) {
            await transaction.rollback();
            return res.status(400).json({ message: "Onaylanmış veya sonuçlanmış izin talepleri iptal edilemez." });
        }

        await leave.update({ leave_status_id: 4 }, { transaction }); // Status 4 = CANCELLED

        await LeaveActivityLog.create({
            leave_record_id: leave.getDataValue('id'),
            performed_by: user_id,
            action: "CANCELLED_BY_USER",
            new_status_id: 4,
            details: "Kullanıcı talebi tarafından iptal edildi."
        }, { transaction });

        await transaction.commit();
        return res.status(200).json({ message: "İzin talebi başarıyla iptal edildi.", data: leave });
    } catch (error) {
        await transaction.rollback();
        console.error("CancelLeave Error:", error);
        return res.status(500).json({ message: "İzin iptal edilirken hata oluştu." });
    }
};

// İzin Talebi Güncelle (Düzenle)
export const updateLeave = async (req: Request, res: Response): Promise<Response> => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { user_id, ...updateData } = req.body;

        const leave = await LeaveRecord.findByPk(id as string);
        if (!leave) {
            await transaction.rollback();
            return res.status(404).json({ message: "İzin talebi bulunamadı." });
        }

        // 1. Sadece sahibi değiştirebilir
        if (leave.getDataValue('user_id') !== user_id) {
            await transaction.rollback();
            return res.status(403).json({ message: "Bu izin talebini düzenleme yetkiniz yok." });
        }

        // 2. Sadece bekleyen (1 veya 2) durumdakiler düzenlenebilir
        const currentStatus = leave.getDataValue('leave_status_id') as number;
        if (currentStatus !== 1 && currentStatus !== 2) {
            await transaction.rollback();
            return res.status(400).json({ message: "Onaylanmış veya sonuçlanmış izin talepleri düzenlenemez." });
        }

        // 3. Güncellemeyi yap
        await leave.update(updateData, { transaction });

        await LeaveActivityLog.create({
            leave_record_id: leave.getDataValue('id'),
            performed_by: user_id,
            action: "UPDATED_BY_USER",
            new_status_id: currentStatus,
            details: "İzin talebi kullanıcı tarafından güncellendi."
        }, { transaction });

        await transaction.commit();
        return res.status(200).json({ message: "İzin talebi başarıyla güncellendi.", data: leave });
    } catch (error) {
        await transaction.rollback();
        console.error("UpdateLeave Error:", error);
        return res.status(500).json({ message: "İzin güncellenirken hata oluştu." });
    }
};
