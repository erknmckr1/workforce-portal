import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class LeaveRecord extends Model {
    public id!: number;
    public user_id!: string;
}

LeaveRecord.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: { type: DataTypes.STRING(255), allowNull: false },
        leave_reason_id: { type: DataTypes.INTEGER, allowNull: false },
        leave_status_id: { type: DataTypes.INTEGER, allowNull: false },
        leave_duration_type_id: { type: DataTypes.INTEGER, allowNull: false },
        auth1_user_id: { type: DataTypes.STRING(255), allowNull: true },
        auth2_user_id: { type: DataTypes.STRING(255), allowNull: true },
        start_date: { type: DataTypes.DATE, allowNull: false },
        end_date: { type: DataTypes.DATE, allowNull: false },
        total_days: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        total_hours: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
        deducted_from_balance: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
        description: { type: DataTypes.STRING(500), allowNull: true },
        phone: { type: DataTypes.STRING(20), allowNull: true },
        address: { type: DataTypes.STRING(255), allowNull: true },
        created_by: { type: DataTypes.STRING(255), allowNull: false },
        auth1_responded_at: { type: DataTypes.DATE, allowNull: true },
        auth2_responded_at: { type: DataTypes.DATE, allowNull: true },
        cancelled_at: { type: DataTypes.DATE, allowNull: true },
        cancelled_by: { type: DataTypes.STRING(255), allowNull: true },
        exit_confirmed_at: { type: DataTypes.DATE, allowNull: true },
        exit_confirmed_by: { type: DataTypes.STRING(255), allowNull: true },
    },
    { 
        sequelize, 
        modelName: "LeaveRecord", 
        tableName: "leave_records",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false
    }
);
