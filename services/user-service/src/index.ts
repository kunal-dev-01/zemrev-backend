import app from "./app.js";
import { connectDB } from "@zemrev/db";
import { handleUnhandledRejection, handleUncaughtException } from "@zemrev/utils";
import env from "@/config/env.config.js";

handleUncaughtException();

connectDB().then(() => {
  const server = app.listen(env.PORT, () => {
    console.log("=".repeat(70));
    console.log("👤 USER SERVICE v2.2 STARTED");
    console.log(`📍 Port: ${env.PORT}`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
    console.log(`🏥 Health: http://localhost:${env.PORT}/health`);
    console.log("");
    console.log("⚡ FEATURES ACTIVE:");
    console.log("   ✅ User Profile Management");
    console.log("=".repeat(70));
  });

  handleUnhandledRejection();

  const shutdown = (signal: string) => {
    console.log(`\n🔄 Received ${signal}, shutting down...`);
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("❌ Forced shutdown");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});