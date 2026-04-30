import { DataTypes, Model } from "sequelize";
import mesSequelize from "../config/mesDatabase";

export interface MesProcessAttributes {
  process_id: string;
  section: string;
  process_name: string;
  area_name: string;
  process_group: string | null;
}

export class MesProcess extends Model<MesProcessAttributes> implements MesProcessAttributes {
  public process_id!: string;
  public section!: string;
  public process_name!: string;
  public area_name!: string;
  public process_group!: string | null;
}

MesProcess.init(
  {
    process_id: {
      type: DataTypes.STRING(6),
      allowNull: false,
      primaryKey: true,
    },
    section: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    process_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    process_group: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize: mesSequelize, // Eski MES veritabanı bağlantısı
    tableName: "process_table",
    timestamps: false,
  }
);
