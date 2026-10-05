import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export interface MesLabelPrintLogAttributes {
  id?: number;
  operator_id?: string | null;
  operator_name?: string | null;
  material_no: string;
  ayar?: string | null;
  brut_weight?: string | null;
  net_weight?: string | null;
  qr_value?: string | null;
  copies?: number;
  status?: string;
  error_message?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MesLabelPrintLog
  extends Model<MesLabelPrintLogAttributes>
  implements MesLabelPrintLogAttributes
{
  public id!: number;
  public operator_id!: string | null;
  public operator_name!: string | null;
  public material_no!: string;
  public ayar!: string | null;
  public brut_weight!: string | null;
  public net_weight!: string | null;
  public qr_value!: string | null;
  public copies!: number;
  public status!: string;
  public error_message!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MesLabelPrintLog.init(
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
    material_no: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ayar: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    brut_weight: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    net_weight: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    qr_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    copies: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "SUCCESS",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "mes_label_print_logs",
    timestamps: true,
    indexes: [
      { name: "idx_mes_label_mat", fields: ["material_no"] },
      { name: "idx_mes_label_operator", fields: ["operator_id"] },
      { name: "idx_mes_label_created_at", fields: ["createdAt"] },
    ],
  }
);

export default MesLabelPrintLog;
