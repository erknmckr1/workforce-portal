import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class ITRequestMessage extends Model {
    public id!: number;
    public request_id!: number;
    public sender_id!: string;
    public message!: string;
    public attachment_url?: string | null;
    public readonly created_at!: Date;
}

ITRequestMessage.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        request_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        sender_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        attachment_url: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "ITRequestMessage",
        tableName: "it_request_messages",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
    }
);
