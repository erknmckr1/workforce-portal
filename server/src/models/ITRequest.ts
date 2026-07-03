import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class ITRequest extends Model {
    public id!: number;
    public operator_id!: string;
    public subject!: string;
    public status!: string;
    public assigned_to?: string;
    public resolved_at?: Date;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

ITRequest.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        operator_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        subject: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "Beklemede",
        },
        assigned_to: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "ITRequest",
        tableName: "it_requests",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);
