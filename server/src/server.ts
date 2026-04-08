import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { sequelize } from "./models";
import authRoutes from "./routes/authRoutes";
import personnelRoutes from "./routes/personnelRoutes";
import leaveRoutes from "./routes/leaveRoutes";
import notificationRoutes from "./routes/notificationRoutes";

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
        "http://192.168.0.77:5173",
        "https://navigational-runtgenographically-joline.ngrok-free.dev",
        "https://two-kings-find.loca.lt"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

app.use(cors(corsOptions));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/personnel", personnelRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/notifications", notificationRoutes);

// DB bağlantısı ve sunucu başlatma
const startServer = async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync(); 

        const server = app.listen(port, () => {
            console.log(`Server is running on port ${port}...`);
        });

        // Server'ın kapanmasını engellemek için hata dinleyicisi
        server.on('error', (e) => {
            console.error('Server error:', e);
        });
    } catch (error) {
        console.error('Database connection or Sync error:', error);
    }
};

startServer();

export default app;
