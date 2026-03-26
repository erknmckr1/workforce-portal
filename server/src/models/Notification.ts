import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database";

export class Notification extends Model {
  public id!: number;
  public user_id!: string;
  public title!: string;
  public message!: string;
  public type!: string; // 'LEAVE_REQUEST', 'APPROVAL_STEP1', 'APPROVED', 'REJECTED'
  public is_read!: boolean;
  public related_id?: number; // İlgili izin_id'si (Direkt o sayfaya link açmak için)
  public readonly created_at!: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    related_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "sys_notifications",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, 
  }
);

export default Notification;
