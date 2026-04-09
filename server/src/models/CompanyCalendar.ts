import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index"; // Veya db nesnesinin import edildiği ana dosya

export class CompanyCalendar extends Model {
    public id!: number;
    public event_date!: Date;
    public event_type!: string; // SALARY, HOLIDAY, CLOSURE, CLOSURE_HALF, WEEKEND vb.
    public title!: string;      // Örn: "Maaş Günü", "Ramazan Bayramı"
    public description!: string;
    public is_half_day!: boolean;
    public color_code!: string; // #EAB308, #22C55E gibi hex kodları tutmak için (esneklik sağlar)
    
    // timestamps
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

CompanyCalendar.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    event_date: {
        type: DataTypes.DATEONLY, // Sadece tarih lazım
        allowNull: false,
    },
    event_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'HOLIDAY'
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    is_half_day: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    color_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
    }
}, {
    sequelize,
    tableName: "company_calendar",
    timestamps: true
});
