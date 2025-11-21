import env from "./env.js";

export const corsOptions = {
  origin: env.CORS_ORIGIN?.split(",").map((o: string) => o.trim()) || [
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-user-id",
    "x-forwarded-for",
    "x-fingerprint",
  ],
  exposedHeaders: ["x-total-count", "x-page-count"],
  maxAge: 86400,
};