import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Timecure Veritabanı bağlantısı
const timecureSequelize = new Sequelize(
    process.env.TIMECURE_DB_NAME || "timecure_app",
    process.env.TIMECURE_DB_USER || "rapor_kullanici",
    process.env.TIMECURE_DB_PASSWORD || "*@midaS2026!*",
    {
        host: process.env.TIMECURE_DB_HOST || "192.168.1.8",
        port: parseInt(process.env.TIMECURE_DB_PORT || "1433"),
        dialect: "mssql",
        dialectOptions: {
            options: {
                encrypt: false,
                trustServerCertificate: true,
            },
        },
        logging: false,
    }
);

export default timecureSequelize;
