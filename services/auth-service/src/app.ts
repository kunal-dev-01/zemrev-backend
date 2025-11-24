import express , { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { corsOptions } from "@/config/cors.config.js";
import { globalErrorHandler, AppError } from "@zemrev/utils";
import env from "@/config/env.config.js";

import authRoutes from "./routes/auth.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import authVerificationRoutes from "./routes/auth.verification.routes.js";
const app: Express = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/health", (_req, res) => {
  const { heapUsed, heapTotal } = process.memoryUsage();
  res.status(200).json({
    success: true,
    service: "AUTH SERVICE",
    version: "2.2.0",
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    memory: {
      heapUsed: `${(heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(heapTotal / 1024 / 1024).toFixed(2)} MB`,
    },
  });
});

app.get("/", (_req, res) => {
  res.send("🔐 Auth Service v2.2 - Production Ready ⚡");
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/auth/verify", authVerificationRoutes);
app.use("/api/v1/payment", paymentRoutes);

app.all("*", (req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use(globalErrorHandler);

export default app;