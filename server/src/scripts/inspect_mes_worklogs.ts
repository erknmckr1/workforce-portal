import { QueryTypes } from "sequelize";
import mesSequelize from "../config/mesDatabase";
import { sequelize } from "../models";

async function main() {
  const candidateTables = await mesSequelize.query(
    `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (
          TABLE_NAME LIKE '%work%'
          OR TABLE_NAME LIKE '%log%'
          OR TABLE_NAME LIKE '%pause%'
          OR TABLE_NAME LIKE '%repair%'
          OR TABLE_NAME LIKE '%stop%'
          OR TABLE_NAME LIKE '%process%'
          OR TABLE_NAME LIKE '%production%'
          OR TABLE_NAME LIKE '%mes%'
          OR TABLE_NAME LIKE '%setup%'
        )
      ORDER BY TABLE_NAME
    `,
    { type: QueryTypes.SELECT }
  );

  const targetTables = await sequelize.query(
    `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME IN ('work_logs', 'work_log_pauses', 'work_log_repairs')
      ORDER BY TABLE_NAME
    `,
    { type: QueryTypes.SELECT }
  );

  const targetCounts = await sequelize.query(
    `
      SELECT 'work_logs' as table_name, COUNT(*) as total FROM work_logs
      UNION ALL
      SELECT 'work_log_pauses', COUNT(*) FROM work_log_pauses
      UNION ALL
      SELECT 'work_log_repairs', COUNT(*) FROM work_log_repairs
    `,
    { type: QueryTypes.SELECT }
  );

  console.log(JSON.stringify({ candidateTables, targetTables, targetCounts }, null, 2));
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
