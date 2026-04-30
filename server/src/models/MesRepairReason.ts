import { DataTypes, Model } from "sequelize";
import mesSequelize from "../config/mesDatabase";

export interface MesRepairReasonAttributes {
  repair_reason_id: string;
  repair_reason: string;
  section: string;
  area_name: string;
}

export class MesRepairReason extends Model<MesRepairReasonAttributes> implements MesRepairReasonAttributes {
  public repair_reason_id!: string;
  public repair_reason!: string;
  public section!: string;
  public area_name!: string;
}

MesRepairReason.init(
  {
    repair_reason_id: {
      type: DataTypes.STRING, 
      allowNull: false,
      primaryKey: true,
    },
    repair_reason: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    section: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize: mesSequelize, // MES veritabanına bağlanır
    tableName: "repair_reason_table",
    timestamps: false,
  }
);
