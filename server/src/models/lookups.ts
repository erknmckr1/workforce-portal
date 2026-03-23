import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class Section extends Model {
    public id!: number;
    public name!: string;
    public is_active!: boolean;
    public manager_id?: string;
}
Section.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        is_active: { type: DataTypes.BOOLEAN },
        manager_id: { type: DataTypes.STRING(255), allowNull: true },
    },
    { sequelize, modelName: "Section", tableName: "sections", timestamps: false }
);

export class Department extends Model {
    public id!: number;
    public section_id?: number;
    public name!: string;
    public is_active!: boolean;
    public supervisor_id?: string;
}
Department.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        section_id: { type: DataTypes.INTEGER, allowNull: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        is_active: { type: DataTypes.BOOLEAN },
        supervisor_id: { type: DataTypes.STRING(255), allowNull: true },
    },
    { sequelize, modelName: "Department", tableName: "departments", timestamps: false }
);

export class JobTitle extends Model {}
JobTitle.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(100), allowNull: false },
        is_active: { type: DataTypes.BOOLEAN },
    },
    { sequelize, modelName: "JobTitle", tableName: "job_titles", timestamps: false }
);

export class Role extends Model {}
Role.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING(50), allowNull: false },
        description: { type: DataTypes.STRING(200), allowNull: true },
    },
    { sequelize, modelName: "Role", tableName: "roles", timestamps: false }
);

export class Permission extends Model {}
Permission.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        module: { type: DataTypes.STRING(50), allowNull: false },
        code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
        label: { type: DataTypes.STRING(100), allowNull: false },
    },
    { sequelize, modelName: "Permission", tableName: "permissions", timestamps: false }
);

export class RolePermission extends Model {}
RolePermission.init(
    {
        role_id: { type: DataTypes.INTEGER, primaryKey: true },
        permission_id: { type: DataTypes.INTEGER, primaryKey: true },
    },
    { sequelize, modelName: "RolePermission", tableName: "role_permissions", timestamps: false }
);
