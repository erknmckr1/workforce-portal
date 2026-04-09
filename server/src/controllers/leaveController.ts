import { Request, Response } from "express";
import {
    LeaveRecord,
    LeaveStatus,
    LeaveReason,
    LeaveDurationType,
    Operator,
    Section,
    LeaveActivityLog,
    Notification
} from "../models";
import { Op, fn } from "sequelize";
import sequelize from "../config/database";

// İzin için gerekli lookup verilerini getir
export const getLeaveLookups = async (req: Request, res: Response): Promise<Response> => {
    try {
        let reasons = await LeaveReason.findAll({ where: { is_active: true } });
        let statuses = await LeaveStatus.findAll();
        let durationTypes = await LeaveDurationType.findAll();

        if (reasons.length === 0) {
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
                { id: 8, code: "DOCTOR_S", label: "Doktor Sevk", required_permission: null },
                { id: 9, code: "DOCTOR_I", label: "Doktor İstirahat", required_permission: null },
            ], { ignoreDuplicates: true });

            reasons = await LeaveReason.findAll({ where: { is_active: true } });
            statuses = await LeaveStatus.findAll();
            durationTypes = await LeaveDurationType.findAll();
        }

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

        const loggedUser = (req as any).user;
        const isAuthorizedForAutoApprove = loggedUser?.role_id === 7 || loggedUser?.role_id === 4 || loggedUser?.role_id === 5; // Admin, İK, Revir
        const shouldAutoApprove = (req.body.status === "Approved" || req.body.is_revir === true) && isAuthorizedForAutoApprove;

        // Revir kaydı değilse ve Şef atanmamışsa hata ver
        if (!shouldAutoApprove && !auth1) {
            await transaction.rollback();
            return res.status(400).json({ message: "Seçili personelin 1. onaycısı (Birim Şefi) atanmamış. Lütfen önce onay hiyerarşisini düzenleyin." });
        }

        // ÇAKIŞMA KONTROLÜ (Overlap Check) - Aynı personelin çakışan aktif/bekleyen izni var mı?
        const overlappingLeave = await LeaveRecord.findOne({
            where: {
                user_id,
                leave_status_id: { [Op.notIn]: [4, 5] },
                [Op.or]: [
                    {
                        start_date: { [Op.lte]: end_date },
                        end_date: { [Op.gte]: start_date }
                    }
                ]
            },
            transaction
        });

        if (overlappingLeave) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Bu tarih aralığında zaten devam eden veya onay bekleyen bir izin talebiniz mevcut."
            });
        }

        // 2. İlk durumu belirle (Revir/Admin ise direkt Onaylı=3, değilse Bekleyen=1)
        const initialStatus = shouldAutoApprove ? 3 : 1;

        // 3. Kaydı oluştur
        const newLeave = await LeaveRecord.create({
            user_id,
            leave_reason_id,
            leave_status_id: initialStatus,
            leave_duration_type_id: leave_duration_type_id || 4,
            auth1_user_id: shouldAutoApprove ? (auth1 || creator_id) : auth1,
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
        let actionEnum = "CREATED";
        if (shouldAutoApprove) actionEnum = "CREATED_BY_REVIR";
        else if (creator_id !== user_id) actionEnum = "CREATED_BY_HR";

        await LeaveActivityLog.create({
            leave_record_id: (newLeave as any).id,
            performed_by: creator_id,
            action: actionEnum,
            new_status_id: initialStatus,
            details: shouldAutoApprove ? "Revir tarafından doğrudan onaylı kayıt oluşturuldu." : "İzin talebi oluşturuldu."
        }, { transaction });

        // --- BİLDİRİM TETİKLE ---
        if (!shouldAutoApprove && auth1) {
            // Normal İzin: Onaycıya bildir
            await Notification.create({
                user_id: auth1,
                title: "Yeni İzin Talebi",
                message: `${targetUser.name} ${targetUser.surname} bir izin talebi oluşturdu. Onayınız bekleniyor.`,
                type: "LEAVE_REQUEST",
                related_id: (newLeave as any).id
            }, { transaction });
        } else if (shouldAutoApprove) {
            // Revir İzni: Personele bildir (Zaten onaylı)
            await Notification.create({
                user_id: user_id,
                title: "Revir İzni Oluşturuldu",
                message: `Revir tarafından adınıza ${req.body.leave_type || 'doktor sevk/istirahat'} izni oluşturulmuştur.`,
                type: "APPROVED",
                related_id: (newLeave as any).id
            }, { transaction });
        }

        await transaction.commit();
        return res.status(201).json({ message: "İzin talebi başarıyla oluşturuldu.", data: newLeave });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("CreateLeave Hatası:", error);
        return res.status(500).json({ message: "İzin talebi oluşturulurken hata oluştu." });
    }
};

// İzinleri Listele (Filtreleme ile)
export const getLeaves = async (req: Request, res: Response): Promise<any> => {
    try {
        const { status_id, approver_id, start_date, end_date, search, leave_reasons, page = 1, limit = 10, is_security } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        // BİLET KONTROLÜNDEN GEÇEN SİTE KULLANICISININ KİMLİĞİ BURADA
        const loggedUser = (req as any).user;
        const roleId = loggedUser?.role_id;
        const userId = loggedUser?.id_dec;

        let where: any = {};
        const isHistory = req.query.is_history === "true";
        const queryUserId = (req.query.user_id || req.query.personnel_id) as string;
        const queryApproverId = req.query.approver_id as string;

        // 0. KİOSK/IFRAME SENARYOSU (Giriş Yapmamış Kullanıcı)
        if (!loggedUser) {
            if (queryUserId) {
                where.user_id = queryUserId;
                if (status_id) where.leave_status_id = status_id;
            } else if (queryApproverId) {
                // Kiosk üzerinden onay bekleyenleri veya geçmişini gör
                if (isHistory) {
                    where.leave_status_id = { [Op.in]: [3, 4, 5] };
                    where[Op.or] = [
                        { auth1_user_id: queryApproverId },
                        { auth2_user_id: queryApproverId }
                    ];
                } else {
                    // Bekleyenler (Sıra kimdeyse o görür)
                    where[Op.or] = [
                        { [Op.and]: [{ auth1_user_id: queryApproverId }, { leave_status_id: 1 }] },
                        { [Op.and]: [{ auth2_user_id: queryApproverId }, { leave_status_id: 2 }] }
                    ];
                }
            }
        }
        // GÜVENLİK ÖNCELİKLİ GÖRÜNÜM: (is_security bayrağı gelmişse veya rolü güvenlikse)
        else if (is_security === "true") {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            where[Op.and] = [
                { leave_status_id: 3 },
                {
                    start_date: {
                        [Op.between]: [todayStart, todayEnd]
                    }
                }
            ];
        }
        // 1. Senaryo (Admin-7, İK-4, Revir-5) => Geniş Erişim Yetkisi
        else if (roleId === 7 || roleId === 4 || roleId === 5) {
            if (queryUserId) {
                where.user_id = queryUserId;
            }

            if (status_id) {
                where.leave_status_id = status_id;
            } else if (approver_id) {
                if (isHistory) {
                    where.leave_status_id = { [Op.in]: [3, 4, 5] };
                } else {
                    where.leave_status_id = { [Op.in]: [1, 2] };
                }
            }
        }
        // 2 & 3. Senaryolar (Müdür-3, Şef-2, Personel-1 vb.) => Onay Odaklı ve Sahiplik Odaklı Dinamik Filtreleme
        else if (loggedUser) {
            if (queryUserId === userId) {
                // Sadece kendi izinlerim sayfası
                where.user_id = userId;
                if (status_id) where.leave_status_id = status_id;
            } else if (approver_id) {
                // ONAY SAYFASI: Rol bağımsız, hiyerarşi ve kademe odaklı filtre
                if (isHistory) {
                    where[Op.or] = [
                        { [Op.and]: [{ auth1_user_id: userId }, { leave_status_id: { [Op.gt]: 1 } }] },
                        { [Op.and]: [{ auth2_user_id: userId }, { leave_status_id: { [Op.in]: [3, 4, 5] } }] }
                    ];
                } else {
                    where[Op.or] = [
                        { [Op.and]: [{ auth1_user_id: userId }, { leave_status_id: 1 }] },
                        { [Op.and]: [{ auth2_user_id: userId }, { leave_status_id: 2 }] }
                    ];
                }
            } else {
                // Genel/Dashboard görünümü: Sahibi veya herhangi bir aşamada onaycısı olduğu tüm izinler
                where[Op.or] = [
                    { user_id: userId },
                    { auth1_user_id: userId },
                    { auth2_user_id: userId }
                ];
                if (status_id) where.leave_status_id = status_id;
            }
        }

        if (leave_reasons) {
            where.leave_reason_id = { [Op.in]: String(leave_reasons).split(',').map(Number) };
        }

        // Veritabanı Sorgusu (Sayfalamalı ve Sayımlı)
        let operatorWhere: any = {};
        if (search) {
            operatorWhere = {
                [Op.or]: [
                    { name: { [Op.like]: `%${search}%` } },
                    { surname: { [Op.like]: `%${search}%` } },
                    { id_dec: { [Op.like]: `%${search}%` } }
                ]
            };
        }

        const { count, rows: leaves } = await LeaveRecord.findAndCountAll({
            where,
            subQuery: false, // İsim arama (required:true) filtrelemesinin doğru çalışması için şart
            include: [
                {
                    model: Operator,
                    as: "User",
                    where: search ? operatorWhere : undefined,
                    required: search ? true : false,
                    attributes: ["name", "surname", "id_dec"],
                    include: [{ model: Section, attributes: ["name"] }]
                },
                { model: LeaveReason, attributes: ["label"] },
                { model: LeaveStatus, attributes: ["label", "code"] },
                { model: LeaveDurationType, attributes: ["label"] },
                { model: Operator, as: "Approver1", attributes: ["name", "surname"] },
                { model: Operator, as: "Approver2", attributes: ["name", "surname"] }
            ],
            order: [["created_at", "DESC"]],
            limit: Number(limit),
            offset: offset,
            distinct: true
        });

        const totalPages = Math.ceil(count / Number(limit));
        return res.status(200).json({
            data: leaves,
            totalCount: count,
            totalPages,
            currentPage: Number(page)
        });
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

        // KİOSK VEYA PANEL KONTROLÜ
        const loggedUser = (req as any).user;
        const loggedRole = loggedUser?.role_id;
        const isAdmin = loggedRole === 7 || loggedRole === 4;

        const currentStatus = leave.getDataValue('leave_status_id') as number;

        if (currentStatus === 1) {
            // ADMIN değilse onaycı kontrolü yap
            if (!isAdmin && leave.getDataValue('auth1_user_id') !== approver_id) {
                await transaction.rollback();
                return res.status(403).json({ message: "Bu izni onaylama yetkiniz yok (1. Onaycı değilsiniz)." });
            }

            const auth1Id = leave.getDataValue('auth1_user_id');
            const auth2Id = leave.getDataValue('auth2_user_id');

            // Eğer 2. onaycı tanımlı değilse VEYA 2. onaycı ile 1. onaycı aynı kişiyse doğrudan TAM ONAY (3)
            const hasValidAuth2 = auth2Id && auth2Id !== auth1Id && auth2Id !== "0" && auth2Id !== "";

            newStatus = hasValidAuth2 ? 2 : 3;
            actionEnum = newStatus === 3 ? "APPROVED" : "APPROVED_STEP1";
        } else if (currentStatus === 2) {
            // ADMIN değilse onaycı kontrolü yap
            if (!isAdmin && leave.getDataValue('auth2_user_id') !== approver_id) {
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

        // --- BİLDİRİM TETİKLE ---
        const leaveOwner = await Operator.findByPk(leave.getDataValue('user_id'));
        if (newStatus === 2 && leave.getDataValue('auth2_user_id')) {
            // 2. Onaycıya bildir
            await Notification.create({
                user_id: leave.getDataValue('auth2_user_id'),
                title: "İzin Onay Sırası",
                message: `${leaveOwner?.name} ${leaveOwner?.surname} personelin izni 1. onaydan geçti. Sizin onayınız bekleniyor.`,
                type: "APPROVAL_STEP1",
                related_id: leave.getDataValue('id')
            }, { transaction });
        } else if (newStatus === 3) {
            // Personele bildir (Onaylandı)
            await Notification.create({
                user_id: leave.getDataValue('user_id'),
                title: "İzniniz Onaylandı",
                message: "İzin talebiniz tüm onay süreçlerinden başarıyla geçerek onaylanmıştır.",
                type: "APPROVED",
                related_id: leave.getDataValue('id')
            }, { transaction });
        }

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

        // --- BİLDİRİM TETİKLE ---
        await Notification.create({
            user_id: leave.getDataValue('user_id'),
            title: "İzin Talebi Reddedildi",
            message: "İzin talebiniz yönetici tarafından reddedilmiştir.",
            type: "REJECTED",
            related_id: leave.getDataValue('id')
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

        const loggedUser = (req as any).user;
        const roleId = loggedUser?.role_id;
        const isAdminOrRevir = roleId === 7 || roleId === 4 || roleId === 5; // Admin, İK, Revir

        // 1. Sadece sahibi VEYA Yetkili (Admin/Revir/İK) iptal edebilir
        if (leave.getDataValue('user_id') !== user_id && !isAdminOrRevir) {
            await transaction.rollback();
            return res.status(403).json({ message: "Bu izin talebini iptal etme yetkiniz yok." });
        }

        const currentStatus = leave.getDataValue('leave_status_id') as number;

        // 2. Zaten bitmiş/iptal edilmiş süreçler
        if (currentStatus === 4 || currentStatus === 5) {
            await transaction.rollback();
            return res.status(400).json({ message: "Bu izin talebi zaten bitmiş veya iptal edilmiş." });
        }

        // 3. Normal personel sadece bekleyenleri (1,2) iptal edebilir. Yetkililer ise onaylanmışı (3) da iptal edebilir.
        if (!isAdminOrRevir && currentStatus !== 1 && currentStatus !== 2) {
            await transaction.rollback();
            return res.status(400).json({ message: "Onaylanmış izin talepleri departman yöneticisi veya revir olmadan iptal edilemez." });
        }

        await leave.update({ leave_status_id: 4 }, { transaction }); // Status 4 = CANCELLED

        await LeaveActivityLog.create({
            leave_record_id: leave.getDataValue('id'),
            performed_by: user_id,
            action: isAdminOrRevir && leave.getDataValue('user_id') !== user_id ? "CANCELLED_BY_ADMIN" : "CANCELLED_BY_USER",
            new_status_id: 4,
            details: isAdminOrRevir && leave.getDataValue('user_id') !== user_id
                ? "Yetkili personel (Revir/Admin/İK) tarafından iptal edildi."
                : "Kullanıcı talebi tarafından iptal edildi."
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

        // GÜNCELLEME İÇİN ÇAKIŞMA KONTROLÜ
        const overlappingLeave = await LeaveRecord.findOne({
            where: {
                id: { [Op.ne]: id }, // Kendisi hariç
                user_id: leave.getDataValue('user_id'),
                leave_status_id: { [Op.notIn]: [4, 5] },
                [Op.or]: [
                    {
                        start_date: { [Op.lte]: updateData.end_date || leave.getDataValue('end_date') },
                        end_date: { [Op.gte]: updateData.start_date || leave.getDataValue('start_date') }
                    }
                ]
            },
            transaction
        });

        if (overlappingLeave) {
            await transaction.rollback();
            return res.status(400).json({
                message: "Güncellenen tarih aralığı başka bir aktif/bekleyen talebinizle çakışmaktadır."
            });
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

// Güvenlik: Personel Çıkış Onayı
export const confirmExit = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { confirmed_by } = req.body;

    try {
        const leave = await LeaveRecord.findByPk(Number(id));
        if (!leave) return res.status(404).json({ message: "İzin talebi bulunamadı." });

        // Sadece onaylanmış izinler çıkış yapabilir
        if (leave.getDataValue('leave_status_id') !== 3) {
            return res.status(400).json({ message: "Sadece onaylanmış izin taleplerinin çıkışı onaylanabilir." });
        }

        await leave.update({
            exit_confirmed_at: fn('GETDATE'),
            exit_confirmed_by: confirmed_by
        });

        await LeaveActivityLog.create({
            leave_record_id: leave.getDataValue('id'),
            performed_by: confirmed_by,
            action: "EXIT_CONFIRMED",
            new_status_id: 3,
            details: "Bekçi tarafından çıkış onaylandı."
        });

        return res.status(200).json({ message: "Çıkış onaylandı.", data: leave });
    } catch (error: any) {
        console.error("ConfirmExit Error:", error);
        return res.status(500).json({ message: `Çıkış onayı başarısız: ${error.message || 'Bilinmeyen SQL hatası'}` });
    }
};
