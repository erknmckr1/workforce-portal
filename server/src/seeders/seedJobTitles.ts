import { sequelize, JobTitle } from "../models";

const seedJobTitles = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected for seeding...");

        await sequelize.sync();

        const titles = [
            "Amir",
            "BakimPersoneli",
            "BolumYoneticisi",
            "Büro İscisi",
            "buzlama",
            "Cirak",
            "EnvanterYoneticisi",
            "GuvenlikPersoneli",
            "IsSaglıgıVeGuvenlıgıUzmanı",
            "KaliphanePersoneli",
            "Kalite Muhendisi",
            "Kimyager",
            "LaboratuvarPersoneli",
            "MerkezPersoneli",
            "Mudur",
            "Muhendis",
            "Mühendis",
            "NPC",
            "Personel",
            "Stajyer",
            "TasarımPersoneli",
            "TemizlikPersoneli",
            "UretimPersonel",
            "UretimPersoneli",
            "Ustabasi",
            "Uzman",
            "UzmanYardimcisi",
            "Yalın Uretim Yoneticisi"
        ];

        let id = 1;
        for (const name of titles) {
            await JobTitle.findOrCreate({
                where: { name: name },
                defaults: { id: id++, name: name, is_active: true }
            });
        }

        process.exit(0);
    } catch (error) {
        console.error(" Seeding failed:", error);
        process.exit(1);
    }
};

seedJobTitles();
