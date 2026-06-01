import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface SectionParticipationLogAttributes {
  id: number;
  operator_id: string;
  op_name: string | null;
  section: string | null;
  area_name: string | null;
  field: string | null;
  machine_name: string | null;
  join_time: Date;
  exit_time: Date | null;
  order_no: string | null;
  uniq_id: string | null;
  status: string | null;
}

export interface SectionParticipationLogCreationAttributes
  extends Optional<SectionParticipationLogAttributes, "id" | "op_name" | "section" | "area_name" | "field" | "machine_name" | "join_time" | "exit_time" | "order_no" | "uniq_id" | "status"> {}

export class SectionParticipationLog
  extends Model<SectionParticipationLogAttributes, SectionParticipationLogCreationAttributes>
  implements SectionParticipationLogAttributes
{
  public id!: number;
  public operator_id!: string;
  public op_name!: string | null;
  public section!: string | null;
  public area_name!: string | null;
  public field!: string | null;
  public machine_name!: string | null;
  public join_time!: Date;
  public exit_time!: Date | null;
  public order_no!: string | null;
  public uniq_id!: string | null;
  public status!: string | null;
}

SectionParticipationLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    operator_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    op_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    section: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    field: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    machine_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    join_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    exit_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    order_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    uniq_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "section_participation_logs",
    timestamps: false,
  }
);

export default SectionParticipationLog;
