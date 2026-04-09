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
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3005",
        "http://127.0.0.1:5173",
        "http://192.168.0.77:5173",
        "http://192.168.0.77:3000",
        "http://192.168.0.77:3001",
        "http://192.168.0.77:3005",
        "http://192.168.3.5:3000", // Eski sistemin IP'si
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

        const startListening = (portToTry: number) => {
            const server = app.listen(portToTry, () => {
                console.log(`Server is running on port ${portToTry}...`);
            }).on('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    if (portToTry === 3003) {
                        console.warn(`Port 3003 is busy, trying port 3005...`);
                        startListening(3005);
                    } else {
                        console.error(`!!! PORT ${portToTry} IS ALSO IN USE !!!`);
                        process.exit(1);
                    }
                } else {
                    console.error('Server error:', err);
                }
            });
        };

        const initialPort = Number(process.env.PORT) || 3003;
        startListening(initialPort);

    } catch (error) {
        console.error('Database connection or Sync error:', error);
    }
};

startServer();

export default app;
