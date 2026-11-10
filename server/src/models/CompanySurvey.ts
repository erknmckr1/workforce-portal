import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface CompanySurveyAttributes {
  id: number;
  title: string;
  description?: string | null;
  form_url: string;
  target_platforms: string; // e.g. "MES,KIOSK,PORTAL"
  is_active: boolean;
  start_date?: Date | null;
  end_date?: Date | null;
  order_index: number;
  created_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export type CompanySurveyCreationAttributes = Optional<
  CompanySurveyAttributes,
  | "id"
  | "description"
  | "target_platforms"
  | "is_active"
  | "start_date"
  | "end_date"
  | "order_index"
  | "created_by"
  | "created_at"
  | "updated_at"
>;

export class CompanySurvey
  extends Model<CompanySurveyAttributes, CompanySurveyCreationAttributes>
  implements CompanySurveyAttributes
{
  public id!: number;
  public title!: string;
  public description!: string | null;
  public form_url!: string;
  public target_platforms!: string;
  public is_active!: boolean;
  public start_date!: Date | null;
  public end_date!: Date | null;
  public order_index!: number;
  public created_by!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CompanySurvey.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    form_url: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    target_platforms: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "MES,KIOSK,PORTAL",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_by: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "CompanySurvey",
    tableName: "company_surveys",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default CompanySurvey;
