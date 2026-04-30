import { DataTypes, Model } from "sequelize";
import timecureSequelize from "../config/timecureDatabase";

export class ExternalMovement extends Model {
    public KisiHareketId!: number;
    public KisiId!: number;
    public Zaman!: Date;
    public KabulGirisCikis!: number; // 1: Giriş, 2: Çıkış
}

ExternalMovement.init(
    {
        KisiHareketId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        KisiId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        Zaman: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        KabulGirisCikis: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        sequelize: timecureSequelize,
        modelName: "ExternalMovement",
        tableName: "KisiHareketler",
        timestamps: false, // OlusturmaZamani'nı manuel kullanıyoruz
    }
);

export default ExternalMovement;
