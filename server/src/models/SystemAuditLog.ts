import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export interface SystemAuditLogAttributes {
  id?: number;
  operator_id?: string | null;
  operator_name?: string | null;
  module: string;
  action_type: string;
  description?: string | null;
  details?: string | null;
  ip_address?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class SystemAuditLog extends Model<SystemAuditLogAttributes> implements SystemAuditLogAttributes {
  public id!: number;
  public operator_id!: string | null;
  public operator_name!: string | null;
  public module!: string;
  public action_type!: string;
  public description!: string | null;
  public details!: string | null;
  public ip_address!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SystemAuditLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    operator_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    operator_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    action_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "system_audit_logs",
    timestamps: true,
    indexes: [
      { name: "idx_audit_module_action", fields: ["module", "action_type"] },
      { name: "idx_audit_operator_id", fields: ["operator_id"] },
      { name: "idx_audit_created_at", fields: ["createdAt"] },
    ],
  }
);

export default SystemAuditLog;
