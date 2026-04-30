import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export interface StatusAttributes {
  id: number;
  name: string;
  description?: string | null;
  color_code?: string | null; // Arayüzde göstereceğimiz renk (Örn: 'success', 'destructive', '#ff0000')
}

export class Status extends Model<StatusAttributes> implements StatusAttributes {
  public id!: number;
  public name!: string;
  public description!: string | null;
  public color_code!: string | null;
}

Status.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      // AutoIncrement vermiyoruz çünkü ID'leri biz belirleyeceğiz (1: Başladı, 2: Durdu vb.)
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    color_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "status_table",
    timestamps: false,
  }
);
