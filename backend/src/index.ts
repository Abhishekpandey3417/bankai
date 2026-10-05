import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import client from "prom-client";
import dotenv from "dotenv";
import prisma from "./config/prisma.js";
import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import cardRoutes from "./routes/card.routes.js";
import transferRoutes from "./routes/transfer.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import aiRoutes from "./routes/ai.routes.js";

dotenv.config();

const app = express();
client.collectDefaultMetrics();

app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
});

const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());

app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.get("/api/health", async (_req, res) => {
    let dbStatus = "disconnected";
    try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = "connected";
    } catch (error) {
        console.error("Database health check failed:", error);
    }

    res.json({
        success: true,
        message: "BankAI backend is running",
        database: dbStatus,
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);


app.listen(PORT, () => {
    console.log(`BankAI backend running on port ${PORT}`);
});