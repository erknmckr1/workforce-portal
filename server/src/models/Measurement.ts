import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class Measurement extends Model {
  public id!: number;
  public order_no!: string;
  public material_no!: string;
  public operator!: string;
  public area_name!: string;
  public entry_measurement!: string | null;
  public exit_measurement!: string | null;
  public entry_weight_50cm!: number | null;
  public exit_weight_50cm!: number | null;
  public description!: string | null;
  public measurement_package!: number | null;
  public data_entry_date!: Date;
  public group_no!: string | null;
  public measure_status!: string | null;
  public who_deleted_measure!: string | null;
  public delete_date!: Date | null;
  public gold_setting!: number | null;
  public gold_pure_scrap!: number | null;
  public measurement_diff!: number | null;
  public weighed_quantity!: number | null;
  public weighed_weight!: number | null;
  public result_weight!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Measurement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_no: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    material_no: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    operator: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entry_measurement: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    exit_measurement: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entry_weight_50cm: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    exit_weight_50cm: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    measurement_package: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    data_entry_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    group_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    measure_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    who_deleted_measure: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    delete_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gold_setting: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    gold_pure_scrap: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    measurement_diff: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    weighed_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    weighed_weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    result_weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "measurements",
    timestamps: true,
  }
);
