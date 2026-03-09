import { sequelize, Permission } from "../models";

const seedPermissions = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected for seeding...");

        await sequelize.sync();

        const permissions = [
            { id: 1, module: "leave", code: "leave.view", label: "Görme" },
            { id: 2, module: "leave", code: "leave.approve_first", label: "1. Onay" },
            { id: 3, module: "leave", code: "leave.approve_second", label: "2. Onay" },
            { id: 4, module: "leave", code: "leave.cancel", label: "İptal" },
            { id: 5, module: "overtime", code: "overtime.create", label: "MesaiOlusturma" },
            { id: 6, module: "overtime", code: "overtime.approve", label: "MesaiOnaylama" },
            { id: 7, module: "overtime", code: "overtime.hr", label: "Mesaidarisler" },
            { id: 8, module: "security", code: "security.view", label: "Guvenlik" },
        ];

        for (const perm of permissions) {
            await Permission.findOrCreate({
                where: { id: perm.id },
                defaults: perm
            });
        }

        console.log(" Permissions seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error(" Seeding failed:", error);
        process.exit(1);
    }
};

seedPermissions();
