import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export interface WorkLogPauseAttributes {
  id?: number;
  work_log_id: number;
  stop_reason_id: string;
  operator_id: string;
  pause_start: Date;
  pause_end?: Date | null;
}

export class WorkLogPause extends Model<WorkLogPauseAttributes> implements WorkLogPauseAttributes {
  public id!: number;
  public work_log_id!: number;
  public stop_reason_id!: string;
  public operator_id!: string;
  public pause_start!: Date;
  public pause_end!: Date | null;
}

WorkLogPause.init(
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
    stop_reason_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    operator_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pause_start: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    pause_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "work_log_pauses",
    timestamps: false,
  }
);
