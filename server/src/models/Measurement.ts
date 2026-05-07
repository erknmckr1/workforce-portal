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
  },
  {
    sequelize,
    tableName: "measurements",
    timestamps: true,
  }
);
