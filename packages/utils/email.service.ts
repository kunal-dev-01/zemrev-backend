// src/modules/emailService/emailService.ts

import axios, { AxiosResponse } from "axios";

const { NOTIFICATION_SERVICE_URL } = process.env;

interface QueueResponse {
  status: string;
  message: string;
}

interface EmailJobData {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, string | number | boolean>;
  fromName?: string;
}

class EmailProducer {
  private static async sendEmailJob(jobData: EmailJobData): Promise<void> {
    try {
      const response: AxiosResponse<QueueResponse> = await axios.post(
        `${NOTIFICATION_SERVICE_URL}/api/v2/email/`,
        jobData,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      if (response.status === 200) {
        console.log(`📧 Email queued for: ${jobData.to}`);
      } else {
        console.warn(`⚠️ Unexpected response for: ${jobData.to}`);
      }
    } catch (error) {
      console.error(`❌ Error sending email for: ${jobData.to}`, error);
    }
  }

  private static async sendTemplateEmail(
    to: string,
    subject: string,
    templateName: string,
    templateData: Record<string, any>,
    fromName = "Zemrev"
  ): Promise<void> {
    await this.sendEmailJob({ to, subject, templateName, templateData, fromName });
  }

  static async sendVerificationEmail(
    to: string,
    fullName: string,
    verificationUrl: string,
    appName: string
  ): Promise<void> {
    await this.sendTemplateEmail(
      to,
      `Verify Your Email - ${appName}`,
      "EmailVerification",
      { fullName, verificationUrl, appName }
    );
  }

  static async sendPasswordResetEmail(
    to: string,
    fullName: string,
    resetUrl: string,
    appName: string
  ): Promise<void> {
    await this.sendTemplateEmail(
      to,
      `Reset Your Password - ${appName}`,
      "PasswordReset",
      { fullName, resetUrl, appName }
    );
  }
}

export default EmailProducer;