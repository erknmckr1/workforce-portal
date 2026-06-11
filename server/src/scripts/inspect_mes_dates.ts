import { QueryTypes } from "sequelize";
import mesSequelize from "../config/mesDatabase";

async function main() {
  const leaves5th = await mesSequelize.query(
    `
      SELECT 
        leave_id,
        op_username,
        leave_creation_date,
        leave_start_date,
        leave_end_date,
        leave_reason,
        leave_status
      FROM dbo.leave_records
      WHERE CONVERT(date, leave_creation_date) = '2026-06-05'
      ORDER BY leave_creation_date DESC
    `,
    { type: QueryTypes.SELECT }
  );

  const leaves8th = await mesSequelize.query(
    `
      SELECT 
        leave_id,
        op_username,
        leave_creation_date,
        leave_start_date,
        leave_end_date,
        leave_reason,
        leave_status
      FROM dbo.leave_records
      WHERE CONVERT(date, leave_creation_date) = '2026-06-08'
      ORDER BY leave_creation_date DESC
    `,
    { type: QueryTypes.SELECT }
  );

  console.log("=== 5 HAZİRAN KAYITLARI ===");
  console.log(`Toplam ${leaves5th.length} kayıt bulundu.`);
  console.log(leaves5th.slice(0, 5)); // Sadece ilk 5 tanesini örnek olarak basalım

  console.log("\n=== 8 HAZİRAN KAYITLARI ===");
  console.log(`Toplam ${leaves8th.length} kayıt bulundu.`);
  console.log(leaves8th.slice(0, 5)); // Sadece ilk 5 tanesini örnek olarak basalım
}

main()
  .catch(console.error)
  .finally(() => mesSequelize.close().catch(() => undefined));
