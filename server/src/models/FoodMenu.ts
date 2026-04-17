import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class FoodMenu extends Model {
    public id!: number;
    public menu_date!: string; // Using DATEONLY which maps to string in TS
    public items!: string; // Stringified JSON array of items
    public note?: string;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

FoodMenu.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        menu_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            unique: true,
        },
        items: {
            type: DataTypes.TEXT, // Store as JSON string: ["Mercimek Çorba", "Döner", ...]
            allowNull: false,
            comment: "JSON stringified array of food items"
        },
        note: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "FoodMenu",
        tableName: "food_menu_table",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);
