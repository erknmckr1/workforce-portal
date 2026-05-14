import { Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import {
  GameProfile,
  GameScore,
  GameSession,
  Operator,
  sequelize,
} from "../models";

const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_POINTS_PER_SECOND = 110;
const SCORE_TOLERANCE = 900;
const VALID_LOCATIONS = new Set(["PRODUCTION", "WAREHOUSE", "OFFICE", "SNOWY"]);

const createSessionSecret = () => {
  return randomBytes(32).toString("hex");
};

const isValidSessionSecret = (expected: string, received: unknown) => {
  if (typeof received !== "string") return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getOrCreateProfile = async (operator_id: string) => {
  let profile = await GameProfile.findOne({ where: { operator_id } });
  if (profile) return profile;

  const operator = await Operator.findOne({ where: { id_dec: operator_id } });
  if (!operator) return null;

  return GameProfile.create({
    operator_id,
    nickname: `${operator.name} ${operator.surname}`,
    best_score: 0,
  });
};

const getScoreRejectionReason = (
  score: unknown,
  elapsedMs: number,
  locationReached: unknown,
) => {
  if (!Number.isInteger(score) || Number(score) <= 0) {
    return "INVALID_SCORE";
  }

  if (
    typeof locationReached !== "string" ||
    !VALID_LOCATIONS.has(locationReached)
  ) {
    return "INVALID_LOCATION";
  }

  if (elapsedMs < 1000) {
    return "SESSION_TOO_SHORT";
  }

  const elapsedSeconds = Math.max(1, elapsedMs / 1000);
  const maxReasonableScore =
    Math.ceil(elapsedSeconds * MAX_POINTS_PER_SECOND) + SCORE_TOLERANCE;

  if (Number(score) > maxReasonableScore) {
    return "SCORE_TOO_HIGH_FOR_DURATION";
  }

  return null;
};

// 1. Oyuncuyu Tanıma (Sicil No ile sorgulama)
export const identifyPlayer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Önce operatör tablosunda bu kişi var mı? (Gerçek kullanıcı eşleşmesi)
    const operator = await Operator.findOne({ where: { id_dec: id } });
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Geçersiz Sicil No. Lütfen gerçek ID'nizi giriniz.",
      });
    }

    // Bu operatörün oyun profili var mı?
    const profile = await GameProfile.findOne({ where: { operator_id: id } });

    res.json({
      success: true,
      exists: !!profile,
      operatorName: `${operator.name} ${operator.surname}`,
      profile: profile || null,
    });
  } catch (error) {
    console.error("Identify player error:", error);
    res
      .status(500)
      .json({ success: false, message: "Sorgulama sırasında hata oluştu." });
  }
};

// 2. Oyun Profili Oluşturma (Lakap seçimi)
export const createProfile = async (req: Request, res: Response) => {
  try {
    const { operator_id, nickname } = req.body;

    // Lakap çakışması kontrolü
    const existing = await GameProfile.findOne({ where: { nickname } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Bu lakap zaten alınmış. Başka bir tane dene!",
      });
    }

    const profile = await GameProfile.create({
      operator_id,
      nickname,
      best_score: 0,
    });

    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    console.error("Create profile error:", error);
    res
      .status(500)
      .json({ success: false, message: "Profil oluşturulamadı." });
  }
};

export const startGameSession = async (req: Request, res: Response) => {
  try {
    const { operator_id } = req.body;

    if (!operator_id) {
      return res
        .status(400)
        .json({ success: false, message: "Operatör ID zorunludur." });
    }

    const operator = await Operator.findOne({ where: { id_dec: operator_id } });
    if (!operator) {
      return res
        .status(404)
        .json({ success: false, message: "Geçersiz operatör ID." });
    }

    await getOrCreateProfile(operator_id);

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + SESSION_TTL_MS);
    const session = await GameSession.create({
      operator_id,
      seed: createSessionSecret(),
      status: "ACTIVE",
      started_at: startedAt,
      expires_at: expiresAt,
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        finishToken: session.seed,
        startedAt,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Start game session error:", error);
    res
      .status(500)
      .json({ success: false, message: "Oyun oturumu başlatılamadı." });
  }
};

export const finishGameSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { score, locationReached, finishToken } = req.body;

    const session = await GameSession.findByPk(String(id));
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Oyun oturumu bulunamadı." });
    }

    if (session.status !== "ACTIVE") {
      return res.status(409).json({
        success: false,
        message: "Bu oyun oturumu zaten tamamlanmış.",
      });
    }

    const now = new Date();
    if (now > session.expires_at) {
      await session.update({
        status: "EXPIRED",
        finished_at: now,
        suspicious_reason: "SESSION_EXPIRED",
      });
      return res
        .status(400)
        .json({ success: false, message: "Oyun oturumunun süresi dolmuş." });
    }

    const elapsedMs = now.getTime() - session.started_at.getTime();

    if (!isValidSessionSecret(session.seed, finishToken)) {
      await session.update({
        status: "REJECTED",
        score: Number.isInteger(score) ? score : null,
        duration_ms: elapsedMs,
        locationReached:
          typeof locationReached === "string" ? locationReached : null,
        suspicious_reason: "INVALID_SESSION_TOKEN",
        finished_at: now,
      });

      return res.status(403).json({
        success: false,
        message: "Oyun oturumu doğrulanamadı.",
        reason: "INVALID_SESSION_TOKEN",
      });
    }

    const rejectionReason = getScoreRejectionReason(
      score,
      elapsedMs,
      locationReached,
    );

    if (rejectionReason) {
      await session.update({
        status: "REJECTED",
        score: Number.isInteger(score) ? score : null,
        duration_ms: elapsedMs,
        locationReached:
          typeof locationReached === "string" ? locationReached : null,
        suspicious_reason: rejectionReason,
        finished_at: now,
      });

      return res.status(400).json({
        success: false,
        message: "Skor doğrulaması başarısız.",
        reason: rejectionReason,
      });
    }

    const profile = await getOrCreateProfile(session.operator_id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Oyuncu profili bulunamadı." });
    }

    const finalScore = Number(score);
    const newScore = await GameScore.create({
      score: finalScore,
      player_name: profile.nickname,
      operator_id: session.operator_id,
      locationReached,
    });

    const isNewRecord = finalScore > profile.best_score;
    if (isNewRecord) {
      await profile.update({ best_score: finalScore });
    }

    await session.update({
      status: "FINISHED",
      score: finalScore,
      duration_ms: elapsedMs,
      locationReached,
      finished_at: now,
    });

    res.status(201).json({ success: true, data: newScore, isNewRecord });
  } catch (error) {
    console.error("Finish game session error:", error);
    res
      .status(500)
      .json({ success: false, message: "Oyun oturumu tamamlanamadı." });
  }
};

// 3. Skor Kaydetme (Doğrudan skor kaydı kapalı)
export const saveScore = async (req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    message:
      "Doğrudan skor kaydı kapatıldı. Lütfen oyun oturumu ile skor gönderin.",
  });
};

// 4. Liderlik Tablosu (Lakaplarla birlikte)
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    // Her oyuncunun sadece EN YÜKSEK skorunu getir (MSSQL ve diğerleri için uyumlu)
    const scores = await GameScore.findAll({
      attributes: [
        "player_name",
        [sequelize.fn("MAX", sequelize.col("score")), "score"],
      ],
      group: ["player_name"],
      order: [[sequelize.literal("MAX(score)"), "DESC"]],
      limit: 10,
      raw: true,
    });

    res.json({ success: true, data: scores });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res
      .status(500)
      .json({ success: false, message: "Liderlik tablosu alınamadı." });
  }
};
