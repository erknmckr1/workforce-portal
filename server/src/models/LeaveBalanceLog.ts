import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class LeaveBalanceLog extends Model {}

LeaveBalanceLog.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: { type: DataTypes.STRING(255), allowNull: false },
        leave_record_id: { type: DataTypes.INTEGER, allowNull: true },
        change_amount: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        balance_after: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        reason: { type: DataTypes.STRING(100), allowNull: false },
    },
    { 
        sequelize, 
        modelName: "LeaveBalanceLog", 
        tableName: "leave_balance_logs",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false
    }
);
