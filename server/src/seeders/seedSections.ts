import { sequelize, Section } from "../models";

const seedSections = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected for seeding...");

        await sequelize.sync();

        const sections = [
            "Arge",
            "Ar-Ge",
            "Atolye",
            "Atölye",
            "BilgiIslem",
            "Döküm",
            "IdariIsler",
            "IhracatvePazarlama",
            "InsanKaynaklari",
            "Kalıphane",
            "KaliteKontrolveSevkiyat",
            "Laboratuvar",
            "Makine",
            "MKP",
            "Montaj",
            "Muhasebe",
            "Satinalma",
            "Tasarim",
            "Teknik",
            "TicariPazarlama",
            "Uretim"
        ];

        let id = 1;
        for (const name of sections) {
            await Section.findOrCreate({
                where: { name: name },
                defaults: { id: id++, name: name, is_active: true }
            });
        }

        console.log(" Sections seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error(" Seeding failed:", error);
        process.exit(1);
    }
};

seedSections();
