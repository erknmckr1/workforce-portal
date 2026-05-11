import { Request, Response } from "express";
import { GameScore, GameProfile, Operator, sequelize } from "../models";

// 1. Oyuncuyu Tanıma (Sicil No ile sorgulama)
export const identifyPlayer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Önce operatör tablosunda bu kişi var mı? (Gerçek kullanıcı eşleşmesi)
    const operator = await Operator.findOne({ where: { id_dec: id } });
    if (!operator) {
      return res.status(404).json({ success: false, message: "Geçersiz Sicil No. Lütfen gerçek ID'nizi giriniz." });
    }

    // Bu operatörün oyun profili var mı?
    const profile = await GameProfile.findOne({ where: { operator_id: id } });

    res.json({ 
      success: true, 
      exists: !!profile,
      operatorName: `${operator.name} ${operator.surname}`,
      profile: profile || null 
    });
  } catch (error) {
    console.error("Identify player error:", error);
    res.status(500).json({ success: false, message: "Sorgulama sırasında hata oluştu." });
  }
};

// 2. Oyun Profili Oluşturma (Lakap seçimi)
export const createProfile = async (req: Request, res: Response) => {
  try {
    const { operator_id, nickname } = req.body;

    // Lakap çakışması kontrolü
    const existing = await GameProfile.findOne({ where: { nickname } });
    if (existing) {
      return res.status(400).json({ success: false, message: "Bu lakap zaten alınmış. Başka bir tane dene!" });
    }

    const profile = await GameProfile.create({
      operator_id,
      nickname,
      best_score: 0
    });

    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    console.error("Create profile error:", error);
    res.status(500).json({ success: false, message: "Profil oluşturulamadı." });
  }
};

// 3. Skor Kaydetme (Geliştirilmiş)
export const saveScore = async (req: Request, res: Response) => {
  try {
    const { score, operator_id, locationReached } = req.body;

    let profile = await GameProfile.findOne({ where: { operator_id } });
    
    // EĞER PROFİL YOKSA AMA GEÇERLİ BİR PERSONELSE, OTOMATİK OLUŞTUR
    if (!profile) {
      const operator = await Operator.findOne({ where: { id_dec: operator_id } });
      if (operator) {
        profile = await GameProfile.create({
          operator_id,
          nickname: `${operator.name} ${operator.surname}`,
          best_score: 0
        });
      } else {
        return res.status(404).json({ success: false, message: "Geçersiz ID. Skor kaydedilemedi." });
      }
    }

    // Genel skor tablosuna ekle
    const newScore = await GameScore.create({
      score,
      player_name: profile.nickname,
      operator_id,
      locationReached,
    });

    // Eğer yeni rekor ise profili güncelle
    const isNewRecord = score > profile.best_score;
    if (isNewRecord) {
      await profile.update({ best_score: score });
    }

    res.status(201).json({ success: true, data: newScore, isNewRecord });
  } catch (error) {
    console.error("Save score error:", error);
    res.status(500).json({ success: false, message: "Skor kaydedilemedi." });
  }
};

// 4. Liderlik Tablosu (Lakaplarla birlikte)
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    // Her oyuncunun sadece EN YÜKSEK skorunu getir (MSSQL ve diğerleri için uyumlu)
    const scores = await GameScore.findAll({
      attributes: [
        "player_name",
        [sequelize.fn("MAX", sequelize.col("score")), "score"]
      ],
      group: ["player_name"],
      order: [[sequelize.literal("MAX(score)"), "DESC"]], // MSSQL için literal gerekebilir
      limit: 10,
      raw: true // Ham veri alalım ki karmaşa olmasın
    });

    res.json({ success: true, data: scores });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ success: false, message: "Liderlik tablosu alınamadı." });
  }
};
