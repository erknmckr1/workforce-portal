import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface VisitorContactAttributes {
  id: number;
  departmentName: string;
  fullName: string;
  title?: string | null;
  phoneExtension?: string | null;
  email?: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VisitorContactCreationAttributes = Optional<
  VisitorContactAttributes,
  "id" | "title" | "phoneExtension" | "email" | "isDefault" | "isActive" | "sortOrder" | "createdAt" | "updatedAt"
>;

export class VisitorContact
  extends Model<VisitorContactAttributes, VisitorContactCreationAttributes>
  implements VisitorContactAttributes
{
  public id!: number;
  public departmentName!: string;
  public fullName!: string;
  public title!: string | null;
  public phoneExtension!: string | null;
  public email!: string | null;
  public isDefault!: boolean;
  public isActive!: boolean;
  public sortOrder!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

VisitorContact.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    departmentName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "department_name",
    },
    fullName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "full_name",
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "title",
    },
    phoneExtension: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "phone_extension",
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "email",
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_default",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
  },
  {
    sequelize,
    tableName: "visitor_contacts",
    timestamps: true,
    indexes: [
      { fields: ["department_name"] },
      { fields: ["is_active"] },
      { fields: ["is_default"] },
    ],
  }
);

export default VisitorContact;
