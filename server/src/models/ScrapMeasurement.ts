import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class ScrapMeasurement extends Model {
  public id!: number;
  public order_no!: string;
  public operator_id!: string;
  public area_name!: string;
  public entry_measurement!: number;
  public exit_measurement!: number;
  public gold_setting!: number;
  public gold_pure_scrap!: number;
  public measurement_diff!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ScrapMeasurement.init(
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
    operator_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entry_measurement: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    exit_measurement: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    gold_setting: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    gold_pure_scrap: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    measurement_diff: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "ScrapMeasurement",
    tableName: "scrap_measurements",
    timestamps: true,
  }
);

export default ScrapMeasurement;
