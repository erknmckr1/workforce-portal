import sequelize from "../config/database";
import { Measurement } from "../models/Measurement";

async function runMigration() {
  console.log("Starting fresh data migration from MES.dbo.measurement_data to MDSN.dbo.measurements...");
  
  try {
    // 1. Veritabanı bağlantısını doğrula
    await sequelize.authenticate();
    console.log("Database connection successful!");

    // 2. Hedef tablodaki mevcut verileri temizle (Sıfırdan temiz bir başlangıç için)
    console.log("Cleaning (Truncating) target measurements table...");
    await sequelize.query("TRUNCATE TABLE measurements");
    console.log("Target table truncated successfully.");

    // 3. Kaynak tablodaki toplam kayıt sayısını al
    const [countResult]: any = await sequelize.query(
      "SELECT COUNT(*) as total FROM MES.dbo.measurement_data"
    );
    const totalCount = countResult[0]?.total || 0;
    console.log(`Total records in source (MES.dbo.measurement_data): ${totalCount}`);

    if (totalCount === 0) {
      console.log("No records to migrate.");
      process.exit(0);
    }

    // 4. Tüm verileri kaynak tablodan çek
    console.log("Fetching data from source database...");
    const [sourceRows]: any[] = await sequelize.query(
      "SELECT * FROM MES.dbo.measurement_data ORDER BY id ASC"
    );
    console.log(`Successfully fetched ${sourceRows.length} rows.`);

    let insertedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // 5. Verileri teker teker işle ve aktar
    for (let i = 0; i < sourceRows.length; i++) {
      const row = sourceRows[i];

      // Zorunlu alanların kontrolü (Sipariş No, Malzeme No, Bölüm, Operator)
      const orderNo = row["Sipariş No"] ? String(row["Sipariş No"]).trim() : "";
      const materialNo = row["Malzeme No"] ? String(row["Malzeme No"]).trim() : "";
      const areaName = row["Bölüm"] ? String(row["Bölüm"]).trim() : "";
      const operator = row["Operator"] ? String(row["Operator"]).trim() : "";
      const entryDate = row["Veri Giriş Tarihi"] ? new Date(row["Veri Giriş Tarihi"]) : new Date();

      if (!orderNo || !materialNo || !areaName || !operator) {
        skippedCount++;
        continue;
      }

      // Açıklama alanı (Orijinal haliyle)
      const description = row["Açıklama"] ? String(row["Açıklama"]).trim() : null;

      // Diğer ek kolonlar
      const groupNo = row["group_no"] ? String(row["group_no"]).trim() : null;
      const measureStatus = row["measure_status"] ? String(row["measure_status"]).trim() : null;
      const whoDeleted = row["who_deleted_measure"] ? String(row["who_deleted_measure"]).trim() : null;
      const deleteDate = row["delete_date"] ? new Date(row["delete_date"]) : null;

      try {
        // Yeni kaydı insert et
        await Measurement.create({
          order_no: orderNo,
          material_no: materialNo,
          operator: operator,
          area_name: areaName.toLowerCase(), // İstasyon isimlerini tutarlılık için küçük harfe çeviriyoruz
          entry_measurement: row["Giriş Ölçüsü"] ? String(row["Giriş Ölçüsü"]).trim() : null,
          exit_measurement: row["Çıkış Ölçüsü"] ? String(row["Çıkış Ölçüsü"]).trim() : null,
          entry_weight_50cm: row["50cm İçin Giriş Gramajı"] !== null ? parseFloat(row["50cm İçin Giriş Gramajı"]) : null,
          exit_weight_50cm: row["50cm İçin Çıkış Gramajı"] !== null ? parseFloat(row["50cm İçin Çıkış Gramajı"]) : null,
          measurement_package: row["Ölçüm Paketi"] !== null ? parseFloat(row["Ölçüm Paketi"]) : null,
          description: description,
          data_entry_date: entryDate,
          group_no: groupNo,
          measure_status: measureStatus,
          who_deleted_measure: whoDeleted,
          delete_date: deleteDate,
          createdAt: entryDate, // Geçmiş tarih doğruluğu için createdAt alanını da veri giriş tarihine eşitliyoruz
          updatedAt: entryDate
        });
        
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting row ID ${row.id}:`, err);
        failedCount++;
      }

      // Her 500 kayıtta bir log yazdır
      if ((i + 1) % 500 === 0) {
        console.log(`Progress: ${i + 1}/${sourceRows.length} processed... (Inserted: ${insertedCount}, Skipped: ${skippedCount}, Failed: ${failedCount})`);
      }
    }

    console.log("\n--- Migration Completed ---");
    console.log(`Total Processed: ${sourceRows.length}`);
    console.log(`Successfully Inserted: ${insertedCount}`);
    console.log(`Skipped (Invalid/Missing required): ${skippedCount}`);
    console.log(`Failed: ${failedCount}`);

  } catch (error) {
    console.error("Migration failed with fatal error:", error);
  } finally {
    process.exit(0);
  }
}

runMigration();
