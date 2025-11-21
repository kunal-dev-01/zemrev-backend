import joi from "joi";
import dotenv from "dotenv";

dotenv.config();

const envSchema = joi
  .object({
    PORT: joi.number().default(5000),
    NODE_ENV: joi
      .string()
      .valid("development", "production", "test")
      .default("development"),
    CORS_ORIGIN: joi.string().required(),
    MONGODB_URL: joi.string().uri().required(),
    GOOGLE_CLIENT_ID: joi.string().required(),
    GOOGLE_CLIENT_SECRET: joi.string().required(),
    GOOGLE_REDIRECT_URI: joi.string().uri().required(),
    JWT_ACCESS_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    REDIS_URL: joi.string().default("redis://localhost:6379"),
    CLIENT_URL: joi.string().uri().required(),
    STRIPE_SECRET_KEY: joi.string().required(),
    STRIPE_PUBLISHABLE_KEY: joi.string().required(),
    STRIPE_WEBHOOK_SECRET: joi.string().required(),
    STRIPE_BASIC_PRICE_ID: joi.string().required(),
    STRIPE_PRO_PRICE_ID: joi.string().required(),
    STRIPE_ELITE_PRICE_ID: joi.string().required(),
    NOTIFICATION_SERVICE_URL: joi.string().uri().required(),
  })
  .unknown(true);

const { error, value } = envSchema.validate(process.env, {
  abortEarly: false,
});

if (error) {
  const details = error.details.map((d) => d.message).join(", ");
  console.error(`❌ Invalid environment configuration: ${details}`);
  process.exit(1);
}

export const getEnv = () => value;

export default value as {
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
  CORS_ORIGIN: string;
  MONGODB_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  REDIS_URL: string;
  CLIENT_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_BASIC_PRICE_ID: string;
  STRIPE_PRO_PRICE_ID: string;
  STRIPE_ELITE_PRICE_ID: string;
  NOTIFICATION_SERVICE_URL: string;
};