import { QueryTypes, Transaction } from "sequelize";
import mesSequelize from "../config/mesDatabase";
import { sequelize } from "../models";

type MesLeaveRecord = {
  leave_id: number;
  leave_uniq_id: string;
  op_username: string;
  id_dec: string;
  auth1: string | null;
  auth2: string | null;
  first_approver_approval_time: Date | string | null;
  second_approver_approval_time: Date | string | null;
  leave_creation_date: Date | string;
  leave_start_date: Date | string;
  leave_end_date: Date | string | null;
  leave_cancel_date: Date | string | null;
  user_who_cancelled: string | null;
  leave_reason: string;
  leave_status: string | null;
  leave_description: string | null;
};

type TargetLeaveFingerprint = {
  user_id: string;
  leave_reason_id: number;
  leave_status_id: number;
  start_date: Date | string;
  end_date: Date | string;
  created_at: Date | string;
  description: string | null;
};

type DuplicateMode = "natural" | "user-date" | "none";

const REASON_ID_BY_OLD_LABEL: Record<string, number> = {
  "Yillik Izin": 1,
  "Doktor Sevk": 8,
  "Doktor Istirahat": 9,
  "Raporlu": 2,
  "Evlilik": 4,
  "1.Derece vefat izni": 5,
  "Dogum": 6,
  "Görevli": 7,
  "Resmi Kuruma Gidecek (Banka, AÖF Büro, Noter vb.)": 7,
  "Yakinini Doktora götürecek/refakat edecek (Anne, Baba, Es, Çocuk)": 7,
  "Özel Gün (Söz, Nisan, Sünnet vb.)": 7,
  "Diger (Açiklama bölümü doldurulmalidir.)": 7,
};

const VALID_STATUS_IDS = new Set([1, 2, 3, 4, 5]);
const DEFAULT_REASON_ID = 7;
const DEFAULT_DURATION_TYPE_ID = 1;
const DESCRIPTION_MAX_LENGTH = 500;

function hasArg(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function cleanId(value: string | null | undefined) {
  const id = String(value ?? "").trim();
  return id.length > 0 ? id : null;
}

function toDate(value: Date | string | null) {
  return value ? new Date(value) : null;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function minuteBucket(value: Date, offsetMinutes = 0) {
  return new Date(value.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 16);
}

function naturalDuplicateKey(
  userId: string,
  reasonId: number,
  statusId: number,
  startDate: Date,
  endDate: Date,
  createdAt: Date
) {
  return [
    userId,
    reasonId,
    statusId,
    dateOnly(startDate),
    dateOnly(endDate),
    minuteBucket(createdAt),
  ].join("|");
}

function userDateDuplicateKey(userId: string, startDate: Date, endDate: Date) {
  return [userId, dateOnly(startDate), dateOnly(endDate)].join("|");
}

function buildDescription(record: MesLeaveRecord) {
  const tag = `[MES_LEAVE_ID:${record.leave_id}; MES_UNIQ:${record.leave_uniq_id}]`;
  const rawDescription = String(record.leave_description ?? "").trim();

  if (!rawDescription) return tag;

  const maxRawLength = DESCRIPTION_MAX_LENGTH - tag.length - 1;
  const clippedDescription =
    rawDescription.length > maxRawLength
      ? rawDescription.slice(0, Math.max(0, maxRawLength))
      : rawDescription;

  return `${clippedDescription}\n${tag}`;
}

function mapStatusId(record: MesLeaveRecord) {
  const statusId = Number(record.leave_status);
  if (VALID_STATUS_IDS.has(statusId)) return statusId;
  return record.leave_cancel_date ? 4 : 3;
}

function mapReasonId(record: MesLeaveRecord, unknownReasons: Map<string, number>) {
  const reasonId = REASON_ID_BY_OLD_LABEL[record.leave_reason];
  if (reasonId) return reasonId;

  unknownReasons.set(record.leave_reason, (unknownReasons.get(record.leave_reason) ?? 0) + 1);
  return DEFAULT_REASON_ID;
}

function getValidOperatorId(id: string | null | undefined, operatorIds: Set<string>) {
  const cleanedId = cleanId(id);
  return cleanedId && operatorIds.has(cleanedId) ? cleanedId : null;
}

function parseLimit() {
  const limitValue = getArgValue("--limit");
  if (!limitValue) return undefined;

  const limit = Number(limitValue);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("--limit pozitif bir tamsayi olmali");
  }
  return limit;
}

function getDuplicateMode(): DuplicateMode {
  if (hasArg("--no-natural-duplicate-check")) return "none";

  const mode = getArgValue("--duplicate-mode");
  if (!mode) return "natural";

  if (mode === "natural" || mode === "user-date" || mode === "none") return mode;

  throw new Error("--duplicate-mode degeri natural, user-date veya none olmali");
}

async function loadOperatorIds() {
  const rows = await sequelize.query<{ id_dec: string }>(
    "SELECT id_dec FROM operator_table",
    { type: QueryTypes.SELECT }
  );

  return new Set(rows.map((row) => String(row.id_dec)));
}

async function loadTargetFingerprints() {
  const rows = await sequelize.query<TargetLeaveFingerprint>(
    `
      SELECT
        user_id,
        leave_reason_id,
        leave_status_id,
        start_date,
        end_date,
        created_at,
        description
      FROM leave_records
    `,
    { type: QueryTypes.SELECT }
  );

  const mesLeaveIds = new Set<number>();
  const naturalKeys = new Set<string>();
  const userDateKeys = new Set<string>();

  for (const row of rows) {
    const match = String(row.description ?? "").match(/MES_LEAVE_ID:(\d+)/);
    if (match) mesLeaveIds.add(Number(match[1]));

    const startDate = toDate(row.start_date);
    const endDate = toDate(row.end_date);
    const createdAt = toDate(row.created_at);
    if (!startDate || !endDate || !createdAt) continue;

    userDateKeys.add(userDateDuplicateKey(String(row.user_id), startDate, endDate));

    for (let offset = -5; offset <= 5; offset += 1) {
      naturalKeys.add(
        naturalDuplicateKey(
          String(row.user_id),
          Number(row.leave_reason_id),
          Number(row.leave_status_id),
          startDate,
          endDate,
          new Date(createdAt.getTime() + offset * 60_000)
        )
      );
    }
  }

  return { mesLeaveIds, naturalKeys, userDateKeys };
}

async function loadMesLeaves(limit?: number) {
  const limitClause = limit ? `TOP ${limit}` : "";

  return mesSequelize.query<MesLeaveRecord>(
    `
      SELECT ${limitClause}
        leave_id,
        leave_uniq_id,
        op_username,
        id_dec,
        auth1,
        auth2,
        first_approver_approval_time,
        second_approver_approval_time,
        leave_creation_date,
        leave_start_date,
        leave_end_date,
        leave_cancel_date,
        user_who_cancelled,
        leave_reason,
        leave_status,
        leave_description
      FROM dbo.leave_records
      ORDER BY leave_id
    `,
    { type: QueryTypes.SELECT }
  );
}

function hasNaturalDuplicate(record: MesLeaveRecord, userId: string, reasonId: number, statusId: number, naturalKeys: Set<string>) {
  const startDate = toDate(record.leave_start_date);
  const endDate = toDate(record.leave_end_date) ?? startDate;
  const createdAt = toDate(record.leave_creation_date);

  if (!startDate || !endDate || !createdAt) return false;

  return naturalKeys.has(naturalDuplicateKey(userId, reasonId, statusId, startDate, endDate, createdAt));
}

function hasUserDateDuplicate(record: MesLeaveRecord, userId: string, userDateKeys: Set<string>) {
  const startDate = toDate(record.leave_start_date);
  const endDate = toDate(record.leave_end_date) ?? startDate;

  if (!startDate || !endDate) return false;

  return userDateKeys.has(userDateDuplicateKey(userId, startDate, endDate));
}

async function insertLeaveRecord(
  record: MesLeaveRecord,
  operatorIds: Set<string>,
  reasonId: number,
  statusId: number,
  transaction: Transaction
) {
  const userId = cleanId(record.id_dec);
  const startDate = toDate(record.leave_start_date);
  const endDate = toDate(record.leave_end_date) ?? startDate;
  const createdAt = toDate(record.leave_creation_date);

  if (!userId || !startDate || !endDate || !createdAt) {
    throw new Error(`MES leave ${record.leave_id} zorunlu tarih/kullanici alanlari eksik`);
  }

  await sequelize.query(
    `
      INSERT INTO leave_records (
        user_id,
        leave_reason_id,
        leave_status_id,
        leave_duration_type_id,
        auth1_user_id,
        auth2_user_id,
        start_date,
        end_date,
        total_days,
        total_hours,
        deducted_from_balance,
        description,
        phone,
        address,
        created_by,
        auth1_responded_at,
        auth2_responded_at,
        cancelled_at,
        cancelled_by,
        exit_confirmed_at,
        exit_confirmed_by,
        created_at
      )
      VALUES (
        :userId,
        :reasonId,
        :statusId,
        :durationTypeId,
        :auth1UserId,
        :auth2UserId,
        :startDate,
        :endDate,
        NULL,
        NULL,
        0,
        :description,
        NULL,
        NULL,
        :createdBy,
        :auth1RespondedAt,
        :auth2RespondedAt,
        :cancelledAt,
        :cancelledBy,
        NULL,
        NULL,
        :createdAt
      )
    `,
    {
      replacements: {
        userId,
        reasonId,
        statusId,
        durationTypeId: DEFAULT_DURATION_TYPE_ID,
        auth1UserId: getValidOperatorId(record.auth1, operatorIds),
        auth2UserId: getValidOperatorId(record.auth2, operatorIds),
        startDate,
        endDate,
        description: buildDescription(record),
        createdBy: userId,
        auth1RespondedAt: toDate(record.first_approver_approval_time),
        auth2RespondedAt: toDate(record.second_approver_approval_time),
        cancelledAt: toDate(record.leave_cancel_date),
        cancelledBy: getValidOperatorId(record.user_who_cancelled, operatorIds),
        createdAt,
      },
      transaction,
    }
  );
}

async function main() {
  const apply = hasArg("--apply");
  const strictUsers = hasArg("--strict-users");
  const requireEmptyTarget = hasArg("--require-empty-target");
  const duplicateMode = getDuplicateMode();
  const limit = parseLimit();
  const operatorIds = await loadOperatorIds();
  const targetFingerprints = await loadTargetFingerprints();
  const records = await loadMesLeaves(limit);
  const unknownReasons = new Map<string, number>();

  const summary = {
    mode: apply ? "apply" : "dry-run",
    sourceRecords: records.length,
    inserted: 0,
    skippedMissingUser: 0,
    preservedMissingUser: 0,
    skippedTaggedDuplicate: 0,
    skippedNaturalDuplicate: 0,
    invalidApproverReferences: 0,
    invalidCancellerReferences: 0,
    reasonFallbacks: 0,
  };

  if (requireEmptyTarget && (targetFingerprints.mesLeaveIds.size > 0 || targetFingerprints.naturalKeys.size > 0)) {
    throw new Error(
      "Hedef leave_records tablosu bos degil. Tum MES kayitlarini birebir tasimak icin once hedef tabloyu bosaltin veya --require-empty-target parametresini kaldirin."
    );
  }

  const transaction = apply ? await sequelize.transaction() : undefined;

  try {
    for (const record of records) {
      const userId = cleanId(record.id_dec);
      if (!userId) {
        summary.skippedMissingUser += 1;
        continue;
      }

      if (!operatorIds.has(userId)) {
        if (strictUsers) {
          summary.skippedMissingUser += 1;
          continue;
        }
        summary.preservedMissingUser += 1;
      }

      const reasonId = mapReasonId(record, unknownReasons);
      const statusId = mapStatusId(record);

      if (cleanId(record.auth1) && !operatorIds.has(cleanId(record.auth1)!)) summary.invalidApproverReferences += 1;
      if (cleanId(record.auth2) && !operatorIds.has(cleanId(record.auth2)!)) summary.invalidApproverReferences += 1;
      if (cleanId(record.user_who_cancelled) && !operatorIds.has(cleanId(record.user_who_cancelled)!)) {
        summary.invalidCancellerReferences += 1;
      }

      if (targetFingerprints.mesLeaveIds.has(record.leave_id)) {
        summary.skippedTaggedDuplicate += 1;
        continue;
      }

      if (
        duplicateMode === "natural" &&
        hasNaturalDuplicate(record, userId, reasonId, statusId, targetFingerprints.naturalKeys)
      ) {
        summary.skippedNaturalDuplicate += 1;
        continue;
      }

      if (duplicateMode === "user-date" && hasUserDateDuplicate(record, userId, targetFingerprints.userDateKeys)) {
        summary.skippedNaturalDuplicate += 1;
        continue;
      }

      if (apply) {
        await insertLeaveRecord(record, operatorIds, reasonId, statusId, transaction!);
      }

      summary.inserted += 1;
    }

    if (apply) await transaction!.commit();
    summary.reasonFallbacks = Array.from(unknownReasons.values()).reduce((sum, count) => sum + count, 0);

    console.log(JSON.stringify({
      ...summary,
      unknownReasons: Object.fromEntries(unknownReasons),
      note: apply
        ? "Migration tamamlandi."
        : "Dry-run tamamlandi. Veri yazmak icin --apply ile calistirin.",
    }, null, 2));
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

main()
  .catch((err) => {
    console.error("MES izin migration hatasi:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mesSequelize.close().catch(() => undefined);
    await sequelize.close().catch(() => undefined);
  });
