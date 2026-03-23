import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { sequelize } from "./models";
import authRoutes from "./routes/authRoutes";
import personnelRoutes from "./routes/personnelRoutes";

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(cookieParser());

const corsOptions = {
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

app.use(cors(corsOptions));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/personnel", personnelRoutes);

// DB bağlantısı ve sunucu başlatma
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log("MSSQL veritabanına bağlantı başarılı.");

        await sequelize.sync(); 
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
