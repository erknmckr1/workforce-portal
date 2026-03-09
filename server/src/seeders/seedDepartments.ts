import { sequelize, Department } from "../models";

const seedDepartments = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected for seeding...");

        await sequelize.sync();

        const departments = [
            "Asit",
            "AsitBosaltma",
            "Atolye",
            "AtolyeMerkez",
            "Bakim",
            "BilgiIslem",
            "Bismark",
            "Buzlama",
            "Cekic",
            "Cila",
            "Cila/Rodaj",
            "DisTicaret",
            "Döküm",
            "DokumTesviye",
            "FanteziHazirlik",
            "Fason",
            "GrafikveReklam",
            "Guvenlik",
            "Halka Kesme",
            "IdariIsler",
            "IhracatvePazarlama",
            "İhracatvePazarlama",
            "InsanKaynaklari",
            "IsSaglıgıVeGuvenlıgı",
            "Kalem",
            "Kaliphane",
            "Kalıphane",
            "Kalite",
            "Kalite Kontrol",
            "KaliteKontrolveSevkiyat",
            "Kaynak",
            "Kesme",
            "Laboratuvar",
            "Lazer(Kesim)",
            "Lazer(Punta)",
            "Makine",
            "MakineMerkez",
            "MaliIsler",
            "MekanikAltin",
            "Merkez",
            "Metalurji",
            "Mihlama",
            "Mine",
            "MKP",
            "Montaj",
            "MontajMerkez",
            "Muhasebe",
            "Ocak",
            "Paketleme",
            "Personel",
            "Pres",
            "SaglikBirimi",
            "Santral",
            "Satinalma",
            "Tasarim",
            "TasarimTezgah",
            "Taslama",
            "Teknik",
            "Teknik Satınalma Uzmanı",
            "Tel/AstarCekme",
            "telcekme",
            "Telçekme",
            "Temizlik",
            "Tezgah",
            "Tezgah/Fantezi",
            "Tezgah/Zincir",
            "TicariPazarlama",
            "Tras",
            "Ulasim",
            "Uretim",
            "Üretim",
            "UretimPlanlama",
            "Yaldiz",
            "YanDestek",
            "YoneticiAsistani",
            "ZincirOrme"
        ];

        let id = 1;
        for (const name of departments) {
            await Department.findOrCreate({
                where: { name: name },
                defaults: { id: id++, name: name, section_id: null, is_active: true }
            });
        }

        console.log(" Departments seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error(" Seeding failed:", error);
        process.exit(1);
    }
};

seedDepartments();
