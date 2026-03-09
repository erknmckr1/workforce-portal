import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class LeaveActivityLog extends Model {}

LeaveActivityLog.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        leave_record_id: { type: DataTypes.INTEGER, allowNull: false },
        performed_by: { type: DataTypes.STRING(255), allowNull: false },
        action: { type: DataTypes.STRING(30), allowNull: false },
        old_status_id: { type: DataTypes.INTEGER, allowNull: true },
        new_status_id: { type: DataTypes.INTEGER, allowNull: true },
        details: { type: DataTypes.STRING(500), allowNull: true },
        ip_address: { type: DataTypes.STRING(45), allowNull: true },
    },
    { 
        sequelize, 
        modelName: "LeaveActivityLog", 
        tableName: "leave_activity_logs",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false
    }
);
