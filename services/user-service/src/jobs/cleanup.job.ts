import cron from "node-cron";
import AbuseDetectionService from "@/services/abuseDetection.service.js";

export const scheduleGuestCleanup = () => {
  cron.schedule("0 3 * * *", async () => {
    console.log("🧹 Starting guest cleanup job...");
    try {
      await AbuseDetectionService.cleanup();
    } catch (error) {
      console.error("❌ Guest cleanup job failed:", error);
    }
  });

  console.log("✅ Guest cleanup job scheduled (daily at 3 AM UTC)");
};