import { Request, Response, NextFunction } from "express";
import AppError from "./appError.js";

export interface ErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  stack?: string;
  timestamp: string;
  path: string;
}

export const globalErrorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";

  const errorResponse: ErrorResponse = {
    success: false,
    message: message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack || "";
  }

  console.error("❌ Error:", {
    message,
    statusCode,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json(errorResponse);
};

export const handleUncaughtException = (): void => {
  process.on("uncaughtException", (err: Error) => {
    console.error("💥 UNCAUGHT EXCEPTION! Shutting down...");
    console.error(err.name, err.message);
    process.exit(1);
  });
};

export const handleUnhandledRejection = (): void => {
  process.on("unhandledRejection", (err: Error) => {
    console.error("💥 UNHANDLED REJECTION! Shutting down...");
    console.error(err.name, err.message);
    process.exit(1);
  });
};