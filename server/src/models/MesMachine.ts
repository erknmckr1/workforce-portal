import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class MesMachine extends Model {
  public id!: number;
  public machine_name!: string;
  public process_name!: string;
  public machine_group!: string | null;
  public area_name!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MesMachine.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    machine_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    process_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    machine_group: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "mes_machines",
    timestamps: true,
  }
);
