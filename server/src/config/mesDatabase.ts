import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// SAP Verilerinin bulunduğu MES veritabanı için ikinci bağlantı
const mesSequelize = new Sequelize(
    "MES", // Veritabanı adı MES
    process.env.DB_USER || "sa",
    process.env.DB_PASSWORD || "PWork2024!",
    {
        host: process.env.DB_HOST || "192.168.3.5",
        port: parseInt(process.env.DB_PORT || "1433"),
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

export default mesSequelize;
