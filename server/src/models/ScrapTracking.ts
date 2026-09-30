import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class ScrapTracking extends Model {
  public id!: number;
  public order_no!: string;
  public karat!: string | null;
  public color!: string | null;
  public description!: string | null;
  public wire_code!: string | null;
  public defect_note!: string | null;
  public is_scrap!: boolean;
  public scrap_location!: string | null;
  public scrap_reason!: string | null;
  public image_url!: string | null;
  public operator_id!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ScrapTracking.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    karat: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    wire_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    defect_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_scrap: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    scrap_location: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    scrap_reason: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    operator_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "ScrapTracking",
    tableName: "scrap_trackings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default ScrapTracking;
