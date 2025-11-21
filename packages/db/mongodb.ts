import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  const isDev = process.env.NODE_ENV === "development";
  const options: mongoose.ConnectOptions = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
    autoIndex: isDev,
    autoCreate: isDev,
    compressors: ["zlib"],
    zlibCompressionLevel: 6,
  };

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URL as string, options);
    console.log("\n" + "=".repeat(50));
    console.log(`✅ MongoDB Connected: ${conn.connection.name} @ ${conn.connection.host}`);
    console.log(`⚡ Connection Pool Size: ${options.maxPoolSize}`);
    console.log("=".repeat(50) + "\n");

    mongoose.connection.on("connected", () => {
      console.log("📡 Mongoose connection established.");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ Mongoose connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ Mongoose disconnected.");
    });

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🔌 Mongoose connection closed due to app termination.");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error);
    process.exit(1);
  }
};

export default connectDB;