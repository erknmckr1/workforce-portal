import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class PasswordResetRequest extends Model {
    public id!: number;
    public user_id!: string;
    public status!: "PENDING" | "COMPLETED" | "REJECTED";
    public handled_by?: string;
    public temporary_password?: string;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

PasswordResetRequest.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
            references: {
                model: "operator_table",
                key: "id_dec",
            },
        },
        status: {
            type: DataTypes.ENUM("PENDING", "COMPLETED", "REJECTED"),
            defaultValue: "PENDING",
        },
        handled_by: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        temporary_password: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "PasswordResetRequest",
        tableName: "password_reset_requests",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);
