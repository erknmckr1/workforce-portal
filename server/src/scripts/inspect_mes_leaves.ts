import { QueryTypes } from "sequelize";
import mesSequelize from "../config/mesDatabase";
import { sequelize } from "../models";

async function main() {
  const mesCounts = await mesSequelize.query(
    "SELECT COUNT(*) as total FROM dbo.leave_records",
    { type: QueryTypes.SELECT }
  );

  const mesStatuses = await mesSequelize.query(
    "SELECT leave_status, COUNT(*) as total FROM dbo.leave_records GROUP BY leave_status ORDER BY total DESC",
    { type: QueryTypes.SELECT }
  );

  const mesReasons = await mesSequelize.query(
    "SELECT leave_reason, COUNT(*) as total FROM dbo.leave_records GROUP BY leave_reason ORDER BY total DESC",
    { type: QueryTypes.SELECT }
  );

  const oldReasons = await mesSequelize.query(
    "SELECT TOP 50 leave_reason_id, leave_reason FROM dbo.leave_reasons ORDER BY leave_reason_id",
    { type: QueryTypes.SELECT }
  );

  const samples = await mesSequelize.query(
    `
      SELECT TOP 10
        leave_id,
        leave_uniq_id,
        op_username,
        id_dec,
        auth1,
        auth2,
        leave_creation_date,
        leave_start_date,
        leave_end_date,
        leave_cancel_date,
        user_who_cancelled,
        leave_reason,
        leave_status,
        leave_description
      FROM dbo.leave_records
      ORDER BY leave_id DESC
    `,
    { type: QueryTypes.SELECT }
  );

  const newLookups = await sequelize.query(
    `
      SELECT 'status' as kind, id, code, label FROM leave_statuses
      UNION ALL
      SELECT 'duration', id, code, label FROM leave_duration_types
      UNION ALL
      SELECT 'reason', id, code, label FROM leave_reasons
      ORDER BY kind, id
    `,
    { type: QueryTypes.SELECT }
  );

  const targetCounts = await sequelize.query(
    "SELECT COUNT(*) as total FROM leave_records",
    { type: QueryTypes.SELECT }
  );

  const targetDatabase = await sequelize.query(
    "SELECT DB_NAME() as db_name",
    { type: QueryTypes.SELECT }
  );

  const targetTaggedMesCount = await sequelize.query(
    "SELECT COUNT(*) as total FROM leave_records WHERE description LIKE '%MES_LEAVE_ID:%'",
    { type: QueryTypes.SELECT }
  );

  const targetUserDateMesMatches = await sequelize.query(
    `
      SELECT COUNT(*) as total
      FROM leave_records target
      WHERE EXISTS (
        SELECT 1
        FROM MES.dbo.leave_records source
        WHERE source.id_dec COLLATE Turkish_CI_AS = target.user_id COLLATE Turkish_CI_AS
          AND CONVERT(date, source.leave_start_date) = CONVERT(date, target.start_date)
          AND CONVERT(date, ISNULL(source.leave_end_date, source.leave_start_date)) = CONVERT(date, target.end_date)
      )
    `,
    { type: QueryTypes.SELECT }
  );

  const mesRecordsMissingInTargetByUserDate = await sequelize.query(
    `
      SELECT COUNT(*) as total
      FROM MES.dbo.leave_records source
      WHERE NOT EXISTS (
        SELECT 1
        FROM leave_records target
        WHERE source.id_dec COLLATE Turkish_CI_AS = target.user_id COLLATE Turkish_CI_AS
          AND CONVERT(date, source.leave_start_date) = CONVERT(date, target.start_date)
          AND CONVERT(date, ISNULL(source.leave_end_date, source.leave_start_date)) = CONVERT(date, target.end_date)
      )
    `,
    { type: QueryTypes.SELECT }
  );

  const operatorCount = await sequelize.query(
    "SELECT COUNT(*) as total FROM operator_table",
    { type: QueryTypes.SELECT }
  );

  const distinctMesUsers = await mesSequelize.query(
    "SELECT COUNT(DISTINCT id_dec) as total FROM dbo.leave_records WHERE id_dec IS NOT NULL",
    { type: QueryTypes.SELECT }
  );

  const distinctMesAuthUsers = await mesSequelize.query(
    `
      SELECT COUNT(DISTINCT user_id) as total
      FROM (
        SELECT auth1 as user_id FROM dbo.leave_records WHERE auth1 IS NOT NULL
        UNION
        SELECT auth2 as user_id FROM dbo.leave_records WHERE auth2 IS NOT NULL
        UNION
        SELECT user_who_cancelled as user_id FROM dbo.leave_records WHERE user_who_cancelled IS NOT NULL
      ) x
    `,
    { type: QueryTypes.SELECT }
  );

  const targetOperators = await sequelize.query(
    "SELECT id_dec FROM operator_table",
    { type: QueryTypes.SELECT }
  );
  const targetOperatorIds = new Set(targetOperators.map((row: any) => String(row.id_dec)));

  const mesUsers = await mesSequelize.query(
    "SELECT DISTINCT id_dec FROM dbo.leave_records WHERE id_dec IS NOT NULL",
    { type: QueryTypes.SELECT }
  );
  const missingMesUsers = mesUsers
    .map((row: any) => String(row.id_dec))
    .filter((id) => !targetOperatorIds.has(id));

  const mesAuthUsers = await mesSequelize.query(
    `
      SELECT DISTINCT user_id
      FROM (
        SELECT auth1 as user_id FROM dbo.leave_records WHERE auth1 IS NOT NULL
        UNION
        SELECT auth2 as user_id FROM dbo.leave_records WHERE auth2 IS NOT NULL
        UNION
        SELECT user_who_cancelled as user_id FROM dbo.leave_records WHERE user_who_cancelled IS NOT NULL
      ) x
    `,
    { type: QueryTypes.SELECT }
  );
  const missingMesAuthUsers = mesAuthUsers
    .map((row: any) => String(row.user_id))
    .filter((id) => !targetOperatorIds.has(id));

  console.log(JSON.stringify({
    mesCounts,
    targetDatabase,
    targetCounts,
    targetTaggedMesCount,
    targetUserDateMesMatches,
    mesRecordsMissingInTargetByUserDate,
    operatorCount,
    distinctMesUsers,
    distinctMesAuthUsers,
    missingMesUserCount: missingMesUsers.length,
    missingMesUserSample: missingMesUsers.slice(0, 20),
    missingMesAuthUserCount: missingMesAuthUsers.length,
    missingMesAuthUserSample: missingMesAuthUsers.slice(0, 20),
    mesStatuses,
    mesReasons,
    oldReasons,
    samples,
    newLookups
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mesSequelize.close().catch(() => undefined);
    await sequelize.close().catch(() => undefined);
  });
