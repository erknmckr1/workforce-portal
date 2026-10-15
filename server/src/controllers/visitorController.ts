import { Request, Response } from "express";
import { Op } from "sequelize";
import Visitor from "../models/Visitor";

// 1. Ziyaretçileri Listele (İçeridekiler veya Geçmiş)
export const getVisitors = async (req: Request, res: Response) => {
  try {
    const { status, search, startDate, endDate } = req.query;

    const whereClause: any = {};

    // İçeridekiler (inside) veya Çıkış Yapanlar (exited)
    if (status === "inside") {
      whereClause.is_inside = true;
    } else if (status === "exited") {
      whereClause.is_inside = false;
    }

    // Arama (Ad Soyad, Plaka, Firma, Ziyaret Edilen, İl, İlçe)
    if (search && typeof search === "string" && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      whereClause[Op.or] = [
        { full_name: { [Op.like]: term } },
        { license_plate: { [Op.like]: term } },
        { company: { [Op.like]: term } },
        { visited_person_or_dept: { [Op.like]: term } },
        { origin_province: { [Op.like]: term } },
        { origin_district: { [Op.like]: term } },
      ];
    }

    // Tarih Aralığı Filtresi (Opsiyonel)
    if (startDate && endDate) {
      whereClause.entry_time = {
        [Op.between]: [new Date(`${startDate} 00:00:00`), new Date(`${endDate} 23:59:59`)],
      };
    }

    const visitors = await Visitor.findAll({
      where: whereClause,
      order: [["entry_time", "DESC"]],
    });

    res.status(200).json(visitors);
  } catch (error) {
    console.error("Ziyaretçi listesi getirilirken hata:", error);
    res.status(500).json({ message: "Ziyaretçi listesi alınırken bir hata oluştu." });
  }
};

// 2. Yeni Ziyaretçi Kaydı (QR veya Güvenlik Manuel)
export const createVisitor = async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      company,
      phone,
      visitedPersonOrDept,
      visitPurpose,
      originProvince,
      originDistrict,
      transportMode,
      vehiclePassengerCount,
      licensePlate,
      notes,
      source,
      kvkkApproved,
    } = req.body;

    if (!fullName || !visitedPersonOrDept || !originProvince || !originDistrict || !transportMode) {
      return res.status(400).json({
        message: "Lütfen zorunlu alanları (Ad Soyad, Ziyaret Edilen, İl, İlçe, Ulaşım Şekli) doldurunuz.",
      });
    }

    const newVisitor = await Visitor.create({
      fullName: fullName.trim(),
      company: company?.trim() || null,
      phone: phone?.trim() || null,
      visitedPersonOrDept: visitedPersonOrDept.trim(),
      visitPurpose: visitPurpose?.trim() || null,
      originProvince: originProvince.trim(),
      originDistrict: originDistrict.trim(),
      transportMode: transportMode.trim(),
      vehiclePassengerCount: vehiclePassengerCount ? Number(vehiclePassengerCount) : null,
      licensePlate: licensePlate ? licensePlate.trim().toUpperCase() : null,
      entryTime: new Date(),
      isInside: true,
      source: source || "Güvenlik – Manuel Kayıt",
      notes: notes?.trim() || null,
      kvkkApproved: kvkkApproved !== undefined ? Boolean(kvkkApproved) : true,
    });

    res.status(201).json(newVisitor);
  } catch (error) {
    console.error("Ziyaretçi kaydı oluşturulurken hata:", error);
    res.status(500).json({ message: "Ziyaretçi kaydı oluşturulamadı." });
  }
};

// 3. Ziyaretçi Çıkış İşlemi (Ekran 5)
export const exitVisitor = async (req: Request, res: Response) => {
  try {
    const visitorId = Number(req.params.id);
    if (isNaN(visitorId)) {
      return res.status(400).json({ message: "Geçersiz ziyaretçi kimliği." });
    }

    const visitor = await Visitor.findByPk(visitorId);
    if (!visitor) {
      return res.status(404).json({ message: "Ziyaretçi kaydı bulunamadı." });
    }

    const { exitTime } = req.body;
    const finalExitTime = exitTime ? new Date(exitTime) : new Date();

    await visitor.update({
      exitTime: finalExitTime,
      isInside: false,
    });

    res.status(200).json(visitor);
  } catch (error) {
    console.error("Ziyaretçi çıkış işlemi hatası:", error);
    res.status(500).json({ message: "Çıkış işlemi gerçekleştirilemedi." });
  }
};
