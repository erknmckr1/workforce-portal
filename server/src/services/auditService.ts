import { Request } from "express";
import jwt from "jsonwebtoken";
import dns from "dns/promises";
import { SystemAuditLog, Operator, Role, Section, Department, JobTitle } from "../models";

const JWT_SECRET = process.env.SECRET_KEY || "super_secret_jwt_key_degistir";

// --- IN-MEMORY CACHE FOR LOOKUPS (Zero extra DB query overhead) ---
interface LookupCache {
  roles: Map<number, string>;
  sections: Map<number, string>;
  departments: Map<number, string>;
  titles: Map<number, string>;
  expiresAt: number;
}

let lookupCache: LookupCache | null = null;

const getCachedLookups = async (): Promise<LookupCache> => {
  const now = Date.now();
  if (lookupCache && lookupCache.expiresAt > now) {
    return lookupCache;
  }

  try {
    const [roles, sections, departments, titles] = await Promise.all([
      Role.findAll({ attributes: ["id", "name"] }),
      Section.findAll({ attributes: ["id", "name"] }),
      Department.findAll({ attributes: ["id", "name"] }),
      JobTitle.findAll({ attributes: ["id", "name"] }),
    ]);

    lookupCache = {
      roles: new Map(roles.map((r: any) => [Number(r.id), r.name])),
      sections: new Map(sections.map((s: any) => [Number(s.id), s.name])),
      departments: new Map(departments.map((d: any) => [Number(d.id), d.name])),
      titles: new Map(titles.map((t: any) => [Number(t.id), t.name])),
      expiresAt: now + 5 * 60 * 1000, // 5 dakika TTL
    };
    return lookupCache;
  } catch (err) {
    console.error("[AuditService] Lookup önbelleklenirken hata oluştu:", err);
    return {
      roles: new Map(),
      sections: new Map(),
      departments: new Map(),
      titles: new Map(),
      expiresAt: now + 30 * 1000,
    };
  }
};

// --- CLIENT IP & REVERSE DNS RESOLUTION (Fast & Safe) ---
export const getClientIp = (req: Request): string | null => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    if (first) return first.trim().replace(/^::ffff:/, "");
  }
  const remote = req.socket.remoteAddress;
  return remote ? remote.trim().replace(/^::ffff:/, "") : null;
};

export const resolveHostnameSafe = async (ip: string | null): Promise<string | null> => {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return null;
  try {
    const hostnames = await Promise.race([
      dns.reverse(ip),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 250)),
    ]);
    return hostnames && hostnames.length > 0 ? hostnames[0] : null;
  } catch {
    return null;
  }
};

// --- ACTOR CONTEXT EXTRACTION ---
export interface AuditActorContext {
  operatorId: string | null;
  operatorName: string;
  clientIp: string | null;
  hostname: string | null;
  userAgent: string | null;
}

export const extractAuditActor = async (req: Request): Promise<AuditActorContext> => {
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

  if (!operatorName && operatorId) {
    try {
      const op = await Operator.findOne({
        where: { id_dec: operatorId },
        attributes: ["name", "surname"],
      });
      if (op) {
        operatorName = `${op.name} ${op.surname}`.trim();
      }
    } catch {}
  }

  const clientIp = getClientIp(req);
  const hostname = await resolveHostnameSafe(clientIp);

  return {
    operatorId,
    operatorName: operatorName || (operatorId ? `Personel (${operatorId})` : "Sistem"),
    clientIp,
    hostname,
    userAgent: (req.headers["user-agent"] as string) || null,
  };
};

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

// --- GENERIC WRITE AUDIT LOG ---
export interface WriteAuditLogParams {
  req: Request;
  module: string;
  actionType: string;
  description: string;
  details?: Record<string, any> | null;
}

export const writeAuditLog = async (params: WriteAuditLogParams): Promise<void> => {
  try {
    const actor = await extractAuditActor(params.req);
    await SystemAuditLog.create({
      operator_id: actor.operatorId,
      operator_name: actor.operatorName,
      module: params.module,
      action_type: params.actionType,
      description: params.description,
      details: params.details
        ? JSON.stringify({
            ...params.details,
            hostname: actor.hostname,
            userAgent: actor.userAgent,
            timestamp: new Date().toISOString(),
          })
        : null,
      ip_address: actor.clientIp,
    });
  } catch (err) {
    console.error(`[AuditService] Log kaydedilirken hata oluştu (${params.module} / ${params.actionType}):`, err);
  }
};

// ==========================================
// 1. ONAY HİYERARŞİSİ LOGLARI
// ==========================================
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

    const actor = await extractAuditActor(req);
    const actorStr = actor.operatorId
      ? `${actor.operatorName} (${actor.operatorId})`
      : actor.operatorName;

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

    await writeAuditLog({
      req,
      module: "APPROVAL_HIERARCHY",
      actionType,
      description,
      details: {
        targetType,
        targetId: String(targetId),
        targetName,
        oldApprover: oldApproverId ? { id: oldApproverId, name: oldApproverName } : null,
        newApprover: newApproverId ? { id: newApproverId, name: newApproverName } : null,
        affectedCount,
        notes,
      },
    });
  } catch (error) {
    console.error("[AuditService] Approval log hatası:", error);
  }
};

// ==========================================
// 2. PERSONEL YÖNETİMİ (/management) LOGLARI
// ==========================================

const FIELD_LABELS: Record<string, string> = {
  name: "İsim",
  surname: "Soyisim",
  nick_name: "Rumuz",
  short_name: "Kısa İsim",
  email: "E-posta",
  gender: "Cinsiyet",
  address: "Adres",
  role_id: "Rol",
  section: "Bölüm",
  department: "Birim",
  title: "Unvan",
  leave_balance: "İzin Bakiyesi",
  route: "Servis Hattı",
  stop_name: "Durak",
  tc_no: "TC Kimlik No",
  external_id: "Harici ID",
  photo_url: "Profil Fotoğrafı",
  is_active: "Aktiflik",
};

/**
 * Yeni personel oluşturulduğunda log kaydeder
 */
export const logPersonnelCreate = async (req: Request, newOperator: Operator): Promise<void> => {
  try {
    const actor = await extractAuditActor(req);
    const actorStr = actor.operatorId
      ? `${actor.operatorName} (${actor.operatorId})`
      : actor.operatorName;

    const lookups = await getCachedLookups();
    const roleName = lookups.roles.get(Number(newOperator.role_id)) || null;
    const sectionName = newOperator.section ? lookups.sections.get(Number(newOperator.section)) || null : null;
    const deptName = newOperator.department ? lookups.departments.get(Number(newOperator.department)) || null : null;

    const summaryParts: string[] = [];
    if (sectionName) summaryParts.push(`Bölüm: ${sectionName}`);
    if (deptName) summaryParts.push(`Birim: ${deptName}`);
    if (roleName) summaryParts.push(`Rol: ${roleName}`);

    const extraStr = summaryParts.length > 0 ? `, ${summaryParts.join(", ")}` : "";
    const description = `${actorStr}, yeni personel '${newOperator.name} ${newOperator.surname}' (ID: ${newOperator.id_dec}${extraStr}) kaydını oluşturdu.`;

    const rawData = { ...newOperator.get() };
    delete (rawData as any).op_password; // Güvenlik için hash'i dahi loglamıyoruz

    await writeAuditLog({
      req,
      module: "PERSONNEL_MANAGEMENT",
      actionType: "CREATE_PERSONNEL",
      description,
      details: {
        targetId: newOperator.id_dec,
        targetName: `${newOperator.name} ${newOperator.surname}`,
        initialData: rawData,
      },
    });
  } catch (error) {
    console.error("[AuditService] Personel ekleme log hatası:", error);
  }
};

/**
 * Personel güncellendiğinde değişen alanları tespit edip diff olarak log kaydeder
 */
export const logPersonnelUpdate = async (
  req: Request,
  targetId: string,
  oldSnapshot: Record<string, any>,
  updateData: Record<string, any>,
  targetFullName?: string
): Promise<void> => {
  try {
    const actor = await extractAuditActor(req);
    const actorStr = actor.operatorId
      ? `${actor.operatorName} (${actor.operatorId})`
      : actor.operatorName;

    const lookups = await getCachedLookups();
    const changes: Record<string, any> = {};
    const summaryItems: string[] = [];

    // Şifre değişti mi?
    if (updateData.op_password) {
      changes.password = { changed: true, note: "Şifre güncellendi" };
      summaryItems.push("Şifre: Güncellendi");
    }

    // Fotoğraf değişti mi?
    if (updateData.photo_url !== undefined && updateData.photo_url !== oldSnapshot.photo_url) {
      changes.photo_url = {
        old: oldSnapshot.photo_url || null,
        new: updateData.photo_url || null,
      };
      summaryItems.push("Fotoğraf: Güncellendi");
    }

    // Diğer temel alanları karşılaştır
    for (const key of Object.keys(updateData)) {
      if (
        key === "id_dec" ||
        key === "id_hex" ||
        key === "op_password" ||
        key === "photo_url" ||
        key === "photo_data" ||
        key === "auth1" ||
        key === "auth2" // auth1 ve auth2 APPROVAL_HIERARCHY modülünde özel olarak loglanıyor
      ) {
        continue;
      }

      const oldVal = oldSnapshot[key] !== undefined && oldSnapshot[key] !== null ? String(oldSnapshot[key]).trim() : "";
      const newVal = updateData[key] !== undefined && updateData[key] !== null ? String(updateData[key]).trim() : "";

      if (oldVal !== newVal) {
        const fieldLabel = FIELD_LABELS[key] || key;

        // Lookuplar için insan tarafından okunabilir isimleri çözümle
        let displayOld = oldVal || "Boş";
        let displayNew = newVal || "Boş";

        if (key === "role_id") {
          displayOld = (oldVal && lookups.roles.get(Number(oldVal))) || displayOld;
          displayNew = (newVal && lookups.roles.get(Number(newVal))) || displayNew;
        } else if (key === "section") {
          displayOld = (oldVal && lookups.sections.get(Number(oldVal))) || displayOld;
          displayNew = (newVal && lookups.sections.get(Number(newVal))) || displayNew;
        } else if (key === "department") {
          displayOld = (oldVal && lookups.departments.get(Number(oldVal))) || displayOld;
          displayNew = (newVal && lookups.departments.get(Number(newVal))) || displayNew;
        } else if (key === "title") {
          displayOld = (oldVal && lookups.titles.get(Number(oldVal))) || displayOld;
          displayNew = (newVal && lookups.titles.get(Number(newVal))) || displayNew;
        }

        changes[key] = {
          old: oldSnapshot[key] ?? null,
          new: updateData[key] ?? null,
          oldLabel: displayOld,
          newLabel: displayNew,
        };

        summaryItems.push(`${fieldLabel} (${displayOld} ➔ ${displayNew})`);
      }
    }

    // Eğer hiçbir alan değişmemişse (sadece boş update veya auth değişikliği) log kirliliği yapma
    if (summaryItems.length === 0) {
      return;
    }

    const name = targetFullName || `${oldSnapshot.name || ""} ${oldSnapshot.surname || ""}`.trim() || targetId;
    const description = `${actorStr}, '${name}' (${targetId}) personelinin bilgilerini güncelledi. Değişenler: ${summaryItems.join(", ")}.`;

    await writeAuditLog({
      req,
      module: "PERSONNEL_MANAGEMENT",
      actionType: "UPDATE_PERSONNEL",
      description,
      details: {
        targetId,
        targetName: name,
        changes,
      },
    });
  } catch (error) {
    console.error("[AuditService] Personel güncelleme log hatası:", error);
  }
};

/**
 * Personel silindiğinde (soft delete) log kaydeder
 */
export const logPersonnelDelete = async (req: Request, operator: Operator): Promise<void> => {
  try {
    const actor = await extractAuditActor(req);
    const actorStr = actor.operatorId
      ? `${actor.operatorName} (${actor.operatorId})`
      : actor.operatorName;

    const name = `${operator.name} ${operator.surname}`.trim();
    const description = `${actorStr}, '${name}' (${operator.id_dec}) personelini pasife aldı (Soft-Delete).`;

    await writeAuditLog({
      req,
      module: "PERSONNEL_MANAGEMENT",
      actionType: "DELETE_PERSONNEL",
      description,
      details: {
        targetId: operator.id_dec,
        targetName: name,
        previousState: {
          is_active: operator.is_active,
          role_id: operator.role_id,
          department: operator.department,
          section: operator.section,
        },
      },
    });
  } catch (error) {
    console.error("[AuditService] Personel silme log hatası:", error);
  }
};
