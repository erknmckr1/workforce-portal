import { sequelize } from "../models";

async function setupDepartmentSections() {
    try {
        console.log("🏗️ Departman - Bölüm Hiyerarşisi Kurulumu Başlıyor...");
        await sequelize.authenticate();
        console.log("📡 Veri tabanına bağlanıldı.");

        // 1. operator_table üzerinden mevcut section-department eşleşmelerini çekiyoruz
        console.log("🔍 Mevcut personel kayıtlarından ilişki haritası çıkarılıyor...");
        const [mappings]: any[] = await sequelize.query(`
            SELECT DISTINCT 
                department as dept_id, 
                section as sec_id 
            FROM MDSN.dbo.operator_table 
            WHERE is_active = 1 AND section IS NOT NULL AND department IS NOT NULL
        `);

        if (!mappings || mappings.length === 0) {
            console.log("ℹ️ Eşleştirilecek aktif personel kaydı bulunamadı.");
            process.exit(0);
        }

        console.log(`📊 Toplam ${mappings.length} benzersiz eşleşme bulundu.`);

        // 2. departments tablosundaki section_id sütunlarını güncelliyoruz
        console.log("⏳ departments tablosu güncelleniyor...");
        
        let updatedCount = 0;
        for (const map of mappings) {
            // Her bir departmanı, personellerin bağlı olduğu section'a bağlıyoruz
            const [updateResult]: any = await sequelize.query(`
                UPDATE MDSN.dbo.departments 
                SET section_id = :sec_id 
                WHERE id = :dept_id
            `, {
                replacements: { 
                    sec_id: map.sec_id, 
                    dept_id: map.dept_id 
                }
            });
            updatedCount++;
        }

        console.log(`\n✅ Başarılı: ${updatedCount} adet birim (department) ilgili bölüme (section) bağlandı.`);
        console.log("🚀 Hiyerarşi başarıyla kuruldu.");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Hata oluştu:", error);
        process.exit(1);
    }
}

setupDepartmentSections();
