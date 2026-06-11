import { QueryTypes } from "sequelize";
import mesSequelize from "../config/mesDatabase";
import { sequelize } from "../models";

async function main() {
  const cutoffDate = "2026-06-09";

  const mesCounts = await mesSequelize.query(
    `SELECT COUNT(*) as total FROM dbo.leave_records WHERE leave_creation_date < '${cutoffDate}'`,
    { type: QueryTypes.SELECT }
  );

  const targetCounts = await sequelize.query(
    `SELECT COUNT(*) as total FROM leave_records WHERE created_at < '${cutoffDate}'`,
    { type: QueryTypes.SELECT }
  );

  const targetTaggedMesCount = await sequelize.query(
    `SELECT COUNT(*) as total FROM leave_records WHERE description LIKE '%MES_LEAVE_ID:%' AND created_at < '${cutoffDate}'`,
    { type: QueryTypes.SELECT }
  );

  const targetUserDateMesMatches = await sequelize.query(
    `
      SELECT COUNT(*) as total
      FROM leave_records target
      WHERE target.created_at < '${cutoffDate}'
        AND EXISTS (
        SELECT 1
        FROM MES.dbo.leave_records source
        WHERE source.id_dec COLLATE Turkish_CI_AS = target.user_id COLLATE Turkish_CI_AS
          AND CONVERT(date, source.leave_start_date) = CONVERT(date, target.start_date)
          AND CONVERT(date, ISNULL(source.leave_end_date, source.leave_start_date)) = CONVERT(date, target.end_date)
          AND source.leave_creation_date < '${cutoffDate}'
      )
    `,
    { type: QueryTypes.SELECT }
  );

  const mesRecordsMissingInTargetByUserDate = await sequelize.query(
    `
      SELECT COUNT(*) as total
      FROM MES.dbo.leave_records source
      WHERE source.leave_creation_date < '${cutoffDate}'
        AND NOT EXISTS (
        SELECT 1
        FROM leave_records target
        WHERE source.id_dec COLLATE Turkish_CI_AS = target.user_id COLLATE Turkish_CI_AS
          AND CONVERT(date, source.leave_start_date) = CONVERT(date, target.start_date)
          AND CONVERT(date, ISNULL(source.leave_end_date, source.leave_start_date)) = CONVERT(date, target.end_date)
      )
    `,
    { type: QueryTypes.SELECT }
  );

  console.log(JSON.stringify({
    mesCounts,
    targetCounts,
    targetTaggedMesCount,
    targetUserDateMesMatches,
    mesRecordsMissingInTargetByUserDate,
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
