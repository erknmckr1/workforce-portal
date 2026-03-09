import { sequelize, LeaveStatus, LeaveReason, LeaveDurationType } from "../models";

const seedLeaves = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected for seeding...");

        await sequelize.sync(); 

        const statuses = [
            { id: 1, code: "PENDING_AUTH1", label: "1. Onaycı Bekleniyor" },
            { id: 2, code: "PENDING_AUTH2", label: "2. Onaycı Bekleniyor" },
            { id: 3, code: "APPROVED", label: "Onaylandı" },
            { id: 4, code: "CANCELLED", label: "İptal Edildi" },
        ];

        for (const status of statuses) {
            await LeaveStatus.findOrCreate({ where: { id: status.id }, defaults: status });
        }

        const durationTypes = [
            { id: 1, code: "FULL_DAY", label: "Tam Gün", deduction_factor: 1.00 },
            { id: 2, code: "HALF_DAY_AM", label: "Yarım Gün (Sabah)", deduction_factor: 0.50 },
            { id: 3, code: "HALF_DAY_PM", label: "Yarım Gün (Öğleden Sonra)", deduction_factor: 0.50 },
            { id: 4, code: "HOURLY", label: "Saatlik İzin", deduction_factor: 0.00 },
        ];

        for (const duration of durationTypes) {
            await LeaveDurationType.findOrCreate({ where: { id: duration.id }, defaults: duration });
        }

        const reasons = [
            { id: 1, code: "ANNUAL", label: "Yıllık İzin", required_permission: null },
            { id: 2, code: "EXCUSE", label: "Mazeret İzni", required_permission: null },
            { id: 3, code: "REST", label: "İstirahat Raporu", required_permission: "leave.view_doctor_reasons" },
            { id: 4, code: "DOCTOR", label: "Doktor Sevk", required_permission: "leave.view_doctor_reasons" },
            { id: 5, code: "PATERNITY", label: "Babalık İzni", required_permission: null },
            { id: 6, code: "MARRIAGE", label: "Evlilik İzni", required_permission: null },
            { id: 7, code: "BEREAVEMENT", label: "Vefat İzni", required_permission: null },
        ];

        for (const reason of reasons) {
            await LeaveReason.findOrCreate({ where: { id: reason.id }, defaults: reason });
        }

        console.log(" Leave lookups seeded successfully!");
        process.exit(0);
    } catch (error) {
        console.error(" Seeding failed:", error);
        process.exit(1);
    }
};

seedLeaves();
