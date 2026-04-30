import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface OperatorBreakAttributes {
  id: number;
  operator_id: string;    // Personel ID (id_dec)
  area_name?: string | null; // Hangi terminalde mola verdi?
  break_reason: string;   // Yemek, Özel Ara, Ramat vb.
  start_date: Date;       // Molaya çıkış
  end_date?: Date | null; // Moladan dönüş
  status: number;         // 1: Aktif, 2: Tamamlandı
}

export interface OperatorBreakCreationAttributes extends Optional<OperatorBreakAttributes, "id" | "end_date" | "status"> {}

export class OperatorBreak extends Model<OperatorBreakAttributes, OperatorBreakCreationAttributes> implements OperatorBreakAttributes {
  public id!: number;
  public operator_id!: string;
  public break_reason!: string;
  public start_date!: Date;
  public end_date!: Date | null;
  public status!: number;
}

OperatorBreak.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    operator_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    break_reason: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1, // 1: Aktif (Mola devam ediyor)
    },
  },
  {
    sequelize,
    tableName: "operator_breaks",
    timestamps: false,
  }
);

export default OperatorBreak;
