import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME || "MDS_TEST",
    process.env.DB_USER || "",
    process.env.DB_PASSWORD || "",
    {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "1433"),
        dialect: "mssql",
        dialectOptions: {
            options: {
                encrypt: false,
                trustServerCertificate: true,
            },
        },
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
    }
);

export default sequelize;
