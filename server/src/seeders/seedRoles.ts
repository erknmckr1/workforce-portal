import { sequelize, Role } from "../models";

const seedRoles = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected for seeding...");

        await sequelize.sync(); // Ensure tables exist

        const roles = [
            { id: 1, name: "Personel", description: "Standart personel yetkisine sahip kullanıcı" },
            { id: 2, name: "Şef", description: "1. Onay makamı - Birim Amiri" },
            { id: 3, name: "Müdür", description: "2. Onay makamı - Bölüm Amiri" },
            { id: 4, name: "İK", description: "İnsan Kaynakları personeli" },
            { id: 5, name: "Revir", description: "Revir ve sağlık görevlileri" },
            { id: 6, name: "Güvenlik", description: "Kapı güvenlik personeli" },
            { id: 7, name: "Admin", description: "Sistem yöneticisi" },
        ];

        for (const role of roles) {
            // Using findOrCreate to avoid duplication if run multiple times
            await Role.findOrCreate({
                where: { id: role.id },
                defaults: role
            });
        }
        console.log(" Roles seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedRoles();
