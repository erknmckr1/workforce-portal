import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class LeaveStatus extends Model {}
LeaveStatus.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
        label: { type: DataTypes.STRING(50), allowNull: false },
    },
    { sequelize, modelName: "LeaveStatus", tableName: "leave_statuses", timestamps: false }
);

export class LeaveReason extends Model {}
LeaveReason.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
        label: { type: DataTypes.STRING(100), allowNull: false },
        required_permission: { type: DataTypes.STRING(50), allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { sequelize, modelName: "LeaveReason", tableName: "leave_reasons", timestamps: false }
);

export class LeaveDurationType extends Model {}
LeaveDurationType.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        label: { type: DataTypes.STRING(50), allowNull: false },
        deduction_factor: { type: DataTypes.DECIMAL(3, 2), allowNull: false },
    },
    { sequelize, modelName: "LeaveDurationType", tableName: "leave_duration_types", timestamps: false }
);
