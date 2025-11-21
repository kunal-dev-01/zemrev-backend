import axios from "axios";
import { getEnv } from "@zemrev/config";

const env = getEnv();

/**
 * INTERNAL SERVICE CALL - Credit Deduction
 * Called from Tool Service when a tool is used
 * 
 * Usage:
 * await InternalService.deductCredits(userId, 5)
 */
class InternalService {
  static async deductCredits(userId: string, credits: number): Promise<void> {
    try {
      await axios.post(
        `http://localhost:3002/api/v1/credit/deduct`,
        { userId, creditsNeeded: credits },
        {
          headers: {
            "x-service-token": process.env.INTERNAL_SERVICE_SECRET,
            "x-service-id": "tool-service",
            "Content-Type": "application/json",
          },
          timeout: 5000,
        }
      );

      console.log(`✅ Credits deducted internally: ${userId} | -${credits}`);
    } catch (error) {
      console.error("❌ Failed to deduct credits:", error);
      throw error;
    }
  }

  static async refundCredits(userId: string, credits: number): Promise<void> {
    try {
      await axios.post(
        `http://localhost:3002/api/v1/credit/refund`,
        { userId, amount: credits },
        {
          headers: {
            "x-service-token": process.env.INTERNAL_SERVICE_SECRET,
            "x-service-id": "tool-service",
            "Content-Type": "application/json",
          },
          timeout: 5000,
        }
      );

      console.log(`✅ Credits refunded internally: ${userId} | +${credits}`);
    } catch (error) {
      console.error("❌ Failed to refund credits:", error);
      throw error;
    }
  }

  static async getUserCredits(userId: string): Promise<any> {
    try {
      const response = await axios.get(`http://localhost:3002/api/v1/credit/status`, {
        headers: {
          "x-service-token": process.env.INTERNAL_SERVICE_SECRET,
          "x-service-id": "tool-service",
        },
        timeout: 5000,
      });

      return response.data.data.credits;
    } catch (error) {
      console.error("❌ Failed to get user credits:", error);
      throw error;
    }
  }
}

export default InternalService;