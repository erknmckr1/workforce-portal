import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database";

export class IntranetDocument extends Model {
  public id!: number;
  public title!: string;
  public description?: string;
  public fileName!: string;
  public filePath!: string;
  public category!: string;
  public fileSize?: number;
  public isActive!: boolean;
  public created_by!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

IntranetDocument.init(
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
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "intranet_documents",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default IntranetDocument;
