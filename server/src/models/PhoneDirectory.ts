import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export interface PhoneDirectoryAttributes {
  id?: number;
  number: string;
  name: string;
  department: string;
}

export class PhoneDirectory extends Model<PhoneDirectoryAttributes> implements PhoneDirectoryAttributes {
  public id!: number;
  public number!: string;
  public name!: string;
  public department!: string;
}

PhoneDirectory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "phone_directory",
    timestamps: true,
  }
);
