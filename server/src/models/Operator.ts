import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class Operator extends Model {
    public id_dec!: string;
    public id_hex!: string;
    public name!: string;
    public surname!: string;
    public nick_name?: string;
    public short_name?: string;
    public op_password?: string;
    public email?: string;
    public gender?: string;
    public address?: string;
    public role_id!: number;
    public section?: number;
    public department?: number;
    public title?: number;
    public auth1?: string;
    public auth2?: string;
    public tc_no?: string;
    public leave_balance!: number;
    public route?: string;
    public stop_name?: string;
    public photo_url?: string;
    public is_active!: number;
}

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
        tc_no: { type: DataTypes.STRING(11), allowNull: true, unique: true },
        leave_balance: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
        route: { type: DataTypes.STRING(255), allowNull: true },
        stop_name: { type: DataTypes.STRING(255), allowNull: true },
        photo_url: { type: DataTypes.STRING(255), allowNull: true },
        is_active: { type: DataTypes.INTEGER, defaultValue: 1 },
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
