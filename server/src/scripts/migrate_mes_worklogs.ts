import { QueryTypes, Transaction } from "sequelize";
import mesSequelize from "../config/mesDatabase";
import { sequelize, Operator } from "../models";
import { WorkLog } from "../models/WorkLog";
import { WorkLogPause } from "../models/WorkLogPause";
import { WorkLogRepair } from "../models/WorkLogRepair";

type MesWorkLog = {
  id: number;
  uniq_id: string;
  user_id_dec: string;
  order_no: string;
  section: string;
  area_name: string;
  work_status: string;
  produced_amount: string | null;
  production_amount: string | null;
  repair_amount: string | null;
  scrap_amount: string | null;
  repair_reason: string | null;
  repair_reason_1: string | null;
  repair_reason_2: string | null;
  repair_reason_3: string | null;
  repair_reason_4: string | null;
  repair_section: string | null;
  scrap_reason: string | null;
  work_start_date: Date | string | null;
  work_end_date: Date | string | null;
  work_finished_op_dec: string | null;
  process_id: string | null;
  process_name: string | null;
  repair_reason_id: string | null;
  cancel_user_id_dec: string | null;
  cancel_reason_id: string | null;
  cancel_date: Date | string | null;
  end_desc: string | null;
  op_username: string | null;
  machine_name: string | null;
  group_no: string | null;
  conditional_finish: string | null;
  group_record_id: string | null;
  field: string | null;
  setup_start_date: Date | string | null;
  setup_end_date: Date | string | null;
  setup_start_id: string | null;
  setup_end_id: string | null;
  old_code: string | null;
  product_count: number | null;
};

type MesStoppedWork = {
  id: number;
  work_log_uniq_id: string | null;
  order_id: string;
  stop_start_date: Date | string | null;
  stop_end_date: Date | string | null;
  stop_reason_id: string | null;
  user_who_stopped: string | null;
  user_who_started: string | null;
  group_record_id: string | null;
  area_name: string | null;
};

type MesRepairReasonLog = {
  id: number;
  work_log_uniq_id: string;
  repair_reason: string;
  gram_amount: string | number;
  created_date: Date | string | null;
};

type RepairReasonLookup = {
  repair_reason_id: string;
  repair_reason: string;
};

const BATCH_SIZE = 500;
const DECIMAL_10_2_MAX = 99999999.99;

function hasArg(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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

function cleanString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeLookup(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR");
}

function toDate(value: Date | string | null | undefined) {
  return value ? new Date(value) : null;
}

function toNumber(value: unknown) {
  const text = cleanString(value);
  if (!text) return null;

  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDecimal10_2(value: unknown) {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return Math.abs(parsed) <= DECIMAL_10_2_MAX ? parsed : null;
}

function toStatus(value: string) {
  const status = Number(value);
  return Number.isInteger(status) ? status : 1;
}

function buildAdditionalData(row: MesWorkLog) {
  return {
    mes_source: "MES.dbo.work_log",
    mes_work_log_id: row.id,
    mes_uniq_id: row.uniq_id,
    produced_amount: cleanString(row.produced_amount),
    production_amount: cleanString(row.production_amount),
    repair_amount: cleanString(row.repair_amount),
    repair_reason: cleanString(row.repair_reason),
    repair_reason_1: cleanString(row.repair_reason_1),
    repair_reason_2: cleanString(row.repair_reason_2),
    repair_reason_3: cleanString(row.repair_reason_3),
    repair_reason_4: cleanString(row.repair_reason_4),
    repair_section: cleanString(row.repair_section),
    scrap_amount: cleanString(row.scrap_amount),
    scrap_reason: cleanString(row.scrap_reason),
    product_count: row.product_count ?? null,
    old_code: cleanString(row.old_code),
    conditional_finish: cleanString(row.conditional_finish),
    group_no: cleanString(row.group_no),
    group_record_id: cleanString(row.group_record_id),
    work_finished_op_dec: cleanString(row.work_finished_op_dec),
    setup_end_id: cleanString(row.setup_end_id),
  };
}

async function getTargetCounts(transaction?: Transaction) {
  const rows = await sequelize.query<{ table_name: string; total: number }>(
    `
      SELECT 'work_logs' as table_name, COUNT(*) as total FROM work_logs
      UNION ALL
      SELECT 'work_log_pauses', COUNT(*) FROM work_log_pauses
      UNION ALL
      SELECT 'work_log_repairs', COUNT(*) FROM work_log_repairs
    `,
    { transaction, type: QueryTypes.SELECT }
  );

  return rows;
}

function assertEmptyTarget(counts: { table_name: string; total: number }[]) {
  const dirtyTables = counts.filter((row) => Number(row.total) > 0);
  if (dirtyTables.length > 0) {
    throw new Error(
      `Hedef tablolar bos degil: ${dirtyTables.map((row) => `${row.table_name}=${row.total}`).join(", ")}`
    );
  }
}

async function loadOperatorIds() {
  const rows = await sequelize.query<{ id_dec: string }>(
    "SELECT id_dec FROM operator_table",
    { type: QueryTypes.SELECT }
  );
  return new Set(rows.map((row) => String(row.id_dec)));
}

async function createMissingOperators(missingOperatorIds: string[], transaction: Transaction) {
  for (const id of missingOperatorIds) {
    await Operator.findOrCreate({
      where: { id_dec: id },
      defaults: {
        id_dec: id,
        id_hex: `MES_MISSING_${id}`,
        name: "MES",
        surname: `Eksik Operator ${id}`,
        role_id: 1,
        leave_balance: 0,
        is_active: 0,
      },
      transaction,
    });
  }
}

async function loadSourceWorkLogs(limit?: number) {
  const limitClause = limit ? `TOP ${limit}` : "";
  return mesSequelize.query<MesWorkLog>(
    `
      SELECT ${limitClause} *
      FROM dbo.work_log
      ORDER BY id
    `,
    { type: QueryTypes.SELECT }
  );
}

async function loadSourcePauses(limit?: number) {
  const limitClause = limit ? `TOP ${limit}` : "";
  return mesSequelize.query<MesStoppedWork>(
    `
      SELECT ${limitClause} *
      FROM dbo.stopped_works_log
      ORDER BY id
    `,
    { type: QueryTypes.SELECT }
  );
}

async function loadSourceRepairs(limit?: number) {
  const limitClause = limit ? `TOP ${limit}` : "";
  return mesSequelize.query<MesRepairReasonLog>(
    `
      SELECT ${limitClause} *
      FROM dbo.repair_reasons_log
      ORDER BY id
    `,
    { type: QueryTypes.SELECT }
  );
}

async function loadRepairReasonLookup() {
  const rows = await mesSequelize.query<RepairReasonLookup>(
    "SELECT repair_reason_id, repair_reason FROM dbo.repair_reason_table",
    { type: QueryTypes.SELECT }
  );

  const lookup = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeLookup(row.repair_reason);
    if (key && !lookup.has(key)) lookup.set(key, row.repair_reason_id);
  }
  return lookup;
}

async function bulkInsertWorkLogs(rows: MesWorkLog[], transaction: Transaction) {
  await sequelize.query("SET IDENTITY_INSERT work_logs ON", { transaction });

  try {
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const batch = rows.slice(index, index + BATCH_SIZE).map((row) => ({
        id: row.id,
        operator_id: row.user_id_dec,
        order_no: row.order_no,
        section_id: cleanString(row.section),
        area_name: cleanString(row.area_name),
        field: cleanString(row.field),
        process_id: cleanString(row.process_id),
        process_name: cleanString(row.process_name),
        machine_name: cleanString(row.machine_name),
        status: toStatus(row.work_status),
        start_date: toDate(row.work_start_date) || new Date(0),
        end_date: toDate(row.work_end_date),
        produced_qty_gr: toDecimal10_2(row.produced_amount),
        produced_qty_pcs: row.product_count ?? null,
        scrap_qty_gr: toDecimal10_2(row.scrap_amount),
        additional_data: buildAdditionalData(row),
        cancel_reason_id: cleanString(row.cancel_reason_id),
        stop_reason_id: null,
        finish_description: cleanString(row.end_desc),
        cancelled_by: cleanString(row.cancel_user_id_dec),
        cancelled_at: toDate(row.cancel_date),
        material_no: null,
        setup_start_date: toDate(row.setup_start_date),
        setup_end_date: toDate(row.setup_end_date),
        setup_operator_id: cleanString(row.setup_start_id),
      }));

      await WorkLog.bulkCreate(batch as any[], { transaction, validate: false });
    }
  } finally {
    await sequelize.query("SET IDENTITY_INSERT work_logs OFF", { transaction });
  }
}

async function bulkInsertPauses(rows: MesStoppedWork[], workLogIdByUniq: Map<string, number>, transaction: Transaction) {
  const pauseRows = rows
    .map((row) => {
      const uniqId = cleanString(row.work_log_uniq_id);
      const workLogId = uniqId ? workLogIdByUniq.get(uniqId) : undefined;
      const pauseStart = toDate(row.stop_start_date);
      if (!workLogId || !pauseStart) return null;

      return {
        work_log_id: workLogId,
        stop_reason_id: cleanString(row.stop_reason_id) || "UNKNOWN",
        operator_id: cleanString(row.user_who_stopped) || cleanString(row.user_who_started) || "SYSTEM",
        pause_start: pauseStart,
        pause_end: toDate(row.stop_end_date),
      };
    })
    .filter(Boolean) as any[];

  for (let index = 0; index < pauseRows.length; index += BATCH_SIZE) {
    await WorkLogPause.bulkCreate(pauseRows.slice(index, index + BATCH_SIZE), { transaction, validate: false });
  }

  return pauseRows.length;
}

async function bulkInsertRepairs(
  rows: MesRepairReasonLog[],
  workLogIdByUniq: Map<string, number>,
  repairReasonIdByName: Map<string, string>,
  repairSectionByUniq: Map<string, string | null>,
  transaction: Transaction
) {
  const unknownRepairReasons = new Map<string, number>();

  const repairRows = rows
    .map((row) => {
      const workLogId = workLogIdByUniq.get(row.work_log_uniq_id);
      if (!workLogId) return null;

      const reasonName = cleanString(row.repair_reason) || "UNKNOWN";
      const reasonId = repairReasonIdByName.get(normalizeLookup(reasonName)) || "UNKNOWN";
      if (reasonId === "UNKNOWN") {
        unknownRepairReasons.set(reasonName, (unknownRepairReasons.get(reasonName) || 0) + 1);
      }

      return {
        work_log_id: workLogId,
        repair_reason_id: reasonId,
        repair_reason_name: reasonName,
        qty: toDecimal10_2(row.gram_amount) || 0,
        target_department: repairSectionByUniq.get(row.work_log_uniq_id) || null,
        created_at: toDate(row.created_date) || new Date(),
      };
    })
    .filter(Boolean) as any[];

  for (let index = 0; index < repairRows.length; index += BATCH_SIZE) {
    await WorkLogRepair.bulkCreate(repairRows.slice(index, index + BATCH_SIZE), { transaction, validate: false });
  }

  return { insertedRepairRows: repairRows.length, unknownRepairReasons };
}

async function main() {
  const apply = hasArg("--apply");
  const requireEmptyTarget = hasArg("--require-empty-target");
  const createMissingOperatorRows = hasArg("--create-missing-operators");
  const limit = parseLimit();

  const beforeCounts = await getTargetCounts();
  if (requireEmptyTarget) assertEmptyTarget(beforeCounts);

  const [sourceWorkLogs, sourcePauses, sourceRepairs, repairReasonLookup, operatorIds] = await Promise.all([
    loadSourceWorkLogs(limit),
    loadSourcePauses(limit),
    loadSourceRepairs(limit),
    loadRepairReasonLookup(),
    loadOperatorIds(),
  ]);

  const workLogIdByUniq = new Map<string, number>();
  const repairSectionByUniq = new Map<string, string | null>();
  const missingOperatorCounts = new Map<string, number>();
  const statusCounts = new Map<number, number>();

  for (const row of sourceWorkLogs) {
    workLogIdByUniq.set(row.uniq_id, row.id);
    repairSectionByUniq.set(row.uniq_id, cleanString(row.repair_section));
    const status = toStatus(row.work_status);
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    if (!operatorIds.has(String(row.user_id_dec))) {
      missingOperatorCounts.set(row.user_id_dec, (missingOperatorCounts.get(row.user_id_dec) || 0) + 1);
    }
  }

  const missingOperatorIds = Array.from(missingOperatorCounts.keys());
  const skippedWorkLogsForMissingOperators = createMissingOperatorRows ? 0 : Array.from(missingOperatorCounts.values()).reduce((sum, count) => sum + count, 0);
  const migratableWorkLogs = sourceWorkLogs.filter((row) => createMissingOperatorRows || operatorIds.has(String(row.user_id_dec)));
  const migratableWorkLogIdsByUniq = new Map<string, number>();
  const migratableRepairSectionByUniq = new Map<string, string | null>();
  for (const row of migratableWorkLogs) {
    migratableWorkLogIdsByUniq.set(row.uniq_id, row.id);
    migratableRepairSectionByUniq.set(row.uniq_id, cleanString(row.repair_section));
  }

  const pauseRowsWithWorkLog = sourcePauses.filter((row) => {
    const uniqId = cleanString(row.work_log_uniq_id);
    return !!uniqId && migratableWorkLogIdsByUniq.has(uniqId) && !!toDate(row.stop_start_date);
  });
  const repairRowsWithWorkLog = sourceRepairs.filter((row) => migratableWorkLogIdsByUniq.has(row.work_log_uniq_id));

  const dryRunSummary = {
    mode: apply ? "apply" : "dry-run",
    sourceWorkLogs: sourceWorkLogs.length,
    migratableWorkLogs: migratableWorkLogs.length,
    skippedWorkLogsForMissingOperators,
    missingOperatorCounts: Object.fromEntries(missingOperatorCounts),
    sourcePauses: sourcePauses.length,
    migratablePauses: pauseRowsWithWorkLog.length,
    skippedPausesWithoutWorkLog: sourcePauses.length - pauseRowsWithWorkLog.length,
    sourceRepairs: sourceRepairs.length,
    migratableRepairs: repairRowsWithWorkLog.length,
    skippedRepairsWithoutWorkLog: sourceRepairs.length - repairRowsWithWorkLog.length,
    statusCounts: Object.fromEntries(statusCounts),
    beforeCounts,
  };

  if (!apply) {
    console.log(JSON.stringify({
      ...dryRunSummary,
      note: "Dry-run tamamlandi. Veri yazmak icin --apply kullanin. Eksik operatorleri placeholder olarak olusturmak icin --create-missing-operators ekleyin.",
    }, null, 2));
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    if (createMissingOperatorRows && missingOperatorIds.length > 0) {
      await createMissingOperators(missingOperatorIds, transaction);
    }

    await bulkInsertWorkLogs(migratableWorkLogs, transaction);
    const insertedPauseRows = await bulkInsertPauses(sourcePauses, migratableWorkLogIdsByUniq, transaction);
    const { insertedRepairRows, unknownRepairReasons } = await bulkInsertRepairs(
      sourceRepairs,
      migratableWorkLogIdsByUniq,
      repairReasonLookup,
      migratableRepairSectionByUniq,
      transaction
    );

    const afterCountsInTransaction = await getTargetCounts(transaction);
    await transaction.commit();

    console.log(JSON.stringify({
      ...dryRunSummary,
      insertedWorkLogs: migratableWorkLogs.length,
      insertedPauseRows,
      insertedRepairRows,
      unknownRepairReasons: Object.fromEntries(unknownRepairReasons),
      afterCounts: afterCountsInTransaction,
      note: "MES work log migration tamamlandi.",
    }, null, 2));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

main()
  .catch((err) => {
    console.error("MES work log migration hatasi:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mesSequelize.close().catch(() => undefined);
    await sequelize.close().catch(() => undefined);
  });


