import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import sequelize from "./config/database";

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(cookieParser());

const corsOptions = {
    origin: [
        "http://localhost:5173", // Vite dev server
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

app.use(cors(corsOptions));

// Test route
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Workforce Portal API is running" });
});

// DB bağlantısı ve sunucu başlatma
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log("MSSQL veritabanına bağlantı başarılı.");

        await sequelize.sync({ alter: false });
        console.log("Tüm modeller senkronize edildi.");

        app.listen(port, () => {
            console.log(`Server çalışıyor: http://localhost:${port}`);
        });
    } catch (error) {
        console.error("❌ Veritabanına bağlanılamadı:", error);
        process.exit(1);
    }
};

startServer();

export default app;
