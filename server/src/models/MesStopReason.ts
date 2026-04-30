import { DataTypes, Model } from "sequelize";
import mesSequelize from "../config/mesDatabase";

export interface MesStopReasonAttributes {
  stop_reason_id: string;
  section: string;
  stop_reason_name: string;
  area_name: string;
}

export class MesStopReason extends Model<MesStopReasonAttributes> implements MesStopReasonAttributes {
  public stop_reason_id!: string;
  public section!: string;
  public stop_reason_name!: string;
  public area_name!: string;
}

MesStopReason.init(
  {
    stop_reason_id: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    section: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stop_reason_name: {
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
    tableName: "stop_reason_table",
    timestamps: false,
  }
);
