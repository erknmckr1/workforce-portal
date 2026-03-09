import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class Operator extends Model {}

Operator.init(
    {
        id_dec: { type: DataTypes.STRING(255), primaryKey: true },
        id_hex: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        surname: { type: DataTypes.STRING(100), allowNull: false },
        nick_name: { type: DataTypes.STRING(100), allowNull: true },
        short_name: { type: DataTypes.STRING(50), allowNull: true },
        op_password: { type: DataTypes.STRING(255), allowNull: true },
        email: { type: DataTypes.STRING(255), allowNull: true },
        gender: { type: DataTypes.STRING(10), allowNull: true },
        address: { type: DataTypes.STRING(255), allowNull: true },
        role_id: { type: DataTypes.INTEGER, allowNull: false },
        section: { type: DataTypes.INTEGER, allowNull: true },
        department: { type: DataTypes.INTEGER, allowNull: true },
        title: { type: DataTypes.INTEGER, allowNull: true },
        auth1: { type: DataTypes.STRING(255), allowNull: true },
        auth2: { type: DataTypes.STRING(255), allowNull: true },
        leave_balance: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
        route: { type: DataTypes.STRING(255), allowNull: true },
        stop_name: { type: DataTypes.STRING(255), allowNull: true },
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    { 
        sequelize, 
        modelName: "Operator", 
        tableName: "operator_table",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false
    }
);
