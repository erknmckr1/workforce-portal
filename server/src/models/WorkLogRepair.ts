import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface WorkLogRepairAttributes {
  id: number;
  work_log_id: number;       // Hangi işe ait?
  repair_reason_id: string;   // Hata/Tamir nedeni ID'si
  repair_reason_name: string; // Raporlarda hızlı görmek için ismi de saklayalım
  qty: number;                // Gramaj
  target_department?: string | null; // Tamire gideceği bölüm
  created_at?: Date;
}

export interface WorkLogRepairCreationAttributes extends Optional<WorkLogRepairAttributes, "id" | "created_at"> {}

export class WorkLogRepair extends Model<WorkLogRepairAttributes, WorkLogRepairCreationAttributes> implements WorkLogRepairAttributes {
  public id!: number;
  public work_log_id!: number;
  public repair_reason_id!: string;
  public repair_reason_name!: string;
  public qty!: number;
  public target_department!: string | null;
  public readonly created_at!: Date;
}

WorkLogRepair.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    work_log_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    repair_reason_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    repair_reason_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    qty: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    target_department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "work_log_repairs",
    timestamps: true,
    updatedAt: false, // Sadece ne zaman yaratıldığını bilsek yeterli
    createdAt: "created_at",
  }
);

export default WorkLogRepair;
