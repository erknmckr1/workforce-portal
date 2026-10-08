import { Request } from "express";
import jwt from "jsonwebtoken";
import { SystemAuditLog, Operator } from "../models";

const JWT_SECRET = process.env.SECRET_KEY || "super_secret_jwt_key_degistir";

export interface LogApprovalHierarchyChangeParams {
  req: Request;
  actionType:
    | "UPDATE_SUPERVISOR"
    | "UPDATE_MANAGER"
    | "UPDATE_USTABASI"
    | "UPDATE_OPERATOR_AUTH"
    | "SYNC_APPROVALS";
  targetType: "DEPARTMENT" | "SECTION" | "OPERATOR" | "GLOBAL";
  targetId: string | number;
  targetName: string;
  oldApproverId?: string | null;
  oldApproverName?: string | null;
  newApproverId?: string | null;
  newApproverName?: string | null;
  affectedCount?: number;
  notes?: string;
}

/**
 * Operatörün adını ve soyadını ID'sinden bulur
 */
export const fetchApproverName = async (id: string | null | undefined): Promise<string | null> => {
  if (!id) return null;
  try {
    const op = await Operator.findOne({
      where: { id_dec: String(id).trim() },
      attributes: ["name", "surname"],
    });
    return op ? `${op.name} ${op.surname}`.trim() : null;
  } catch {
    return null;
  }
};

/**
 * Onay hiyerarşisi değişikliklerini system_audit_logs tablosuna kaydeder
 */
export const logApprovalHierarchyChange = async (
  params: LogApprovalHierarchyChangeParams
): Promise<void> => {
  try {
    const {
      req,
      actionType,
      targetType,
      targetId,
      targetName,
      oldApproverId = null,
      oldApproverName = null,
      newApproverId = null,
      newApproverName = null,
      affectedCount = 0,
      notes = null,
    } = params;

    // 1. Giriş yapmış kullanıcıyı bul (req.user veya Cookie/Bearer token)
    let operatorId: string | null = req.user?.id_dec ? String(req.user.id_dec) : null;
    let operatorName: string | null = req.user
      ? `${req.user.name || ""} ${req.user.surname || ""}`.trim()
      : null;

    if (!operatorId) {
      const token =
        req.cookies?.auth_token ||
        (req.headers?.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.slice(7)
          : null);

      if (token) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          if (decoded?.id_dec) {
            operatorId = String(decoded.id_dec);
            operatorName = `${decoded.name || ""} ${decoded.surname || ""}`.trim();
          }
        } catch {}
      }
    }

    // İsmi hala boşsa ve ID varsa veritabanından çek
    if (!operatorName && operatorId) {
      const op = await Operator.findOne({
        where: { id_dec: operatorId },
        attributes: ["name", "surname"],
      });
      if (op) {
        operatorName = `${op.name} ${op.surname}`.trim();
      }
    }

    // İstemci IP adresi
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;

    // 2. İnsan tarafından rahatça okunabilecek Türkçe özet açıklaması
    const actorStr = operatorName
      ? `${operatorName} (${operatorId || "ID yok"})`
      : operatorId
      ? `Personel ID: ${operatorId}`
      : "Sistem Yöneticisi";

    const oldStr = oldApproverName
      ? `${oldApproverName} [${oldApproverId}]`
      : oldApproverId
      ? `ID: ${oldApproverId}`
      : "Yok (Atanmamış)";

    const newStr = newApproverName
      ? `${newApproverName} [${newApproverId}]`
      : newApproverId
      ? `ID: ${newApproverId}`
      : "Kaldırıldı (Boş)";

    let description = "";
    switch (actionType) {
      case "UPDATE_SUPERVISOR":
        description = `${actorStr}, '${targetName}' biriminin 1. Onaycısını (Birim Sorumlusu) güncelledi. Eski: ${oldStr} ➔ Yeni: ${newStr}. (${affectedCount} personelin onay zinciri güncellendi).`;
        break;

      case "UPDATE_MANAGER":
        description = `${actorStr}, '${targetName}' bölümünün 2. Onaycısını (Bölüm Müdürü) güncelledi. Eski: ${oldStr} ➔ Yeni: ${newStr}. (${affectedCount} personelin onay zinciri güncellendi).`;
        break;

      case "UPDATE_USTABASI":
        description = `${actorStr}, '${targetName}' biriminin Ustabaşısını güncelledi. Eski: ${oldStr} ➔ Yeni: ${newStr}. (${affectedCount} personelin onay zinciri güncellendi).`;
        break;

      case "UPDATE_OPERATOR_AUTH":
        description = `${actorStr}, '${targetName}' personelinin onaycılarını doğrudan güncelledi. ${notes ? `(${notes})` : ""}`;
        break;

      case "SYNC_APPROVALS":
        description = `${actorStr}, tüm organizasyonun onay hiyerarşisini toplu olarak senkronize etti. (${affectedCount} personelin onay zinciri güncellendi).`;
        break;

      default:
        description = `${actorStr}, '${targetName}' onay hiyerarşisinde değişiklik yaptı.`;
    }

    // 3. system_audit_logs tablosuna kaydet
    await SystemAuditLog.create({
      operator_id: operatorId,
      operator_name: operatorName || "Yönetici",
      module: "APPROVAL_HIERARCHY",
      action_type: actionType,
      description,
      details: JSON.stringify({
        targetType,
        targetId: String(targetId),
        targetName,
        oldApprover: oldApproverId ? { id: oldApproverId, name: oldApproverName } : null,
        newApprover: newApproverId ? { id: newApproverId, name: newApproverName } : null,
        affectedCount,
        notes,
        userAgent: req.headers["user-agent"] || null,
        timestamp: new Date().toISOString(),
      }),
      ip_address: clientIp,
    });
  } catch (error) {
    console.error("[ApprovalAuditService] Loglama sırasında hata oluştu:", error);
  }
};
