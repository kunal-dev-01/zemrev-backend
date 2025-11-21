// src/config/appConfig/env.config.ts

import joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = joi
  .object({
    PORT: joi.number().default(5000),
    NODE_ENV: joi.string().valid('development', 'production', 'test').default('development'),
    CORS_ORIGIN: joi.string().uri().required(),
    MONGODB_URL: joi.string().uri().required(),
    JWT_ACCESS_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    REDIS_USERNAME: joi.string(),
    REDIS_PASSWORD: joi.string(),
    REDIS_HOST: joi.string(),
    REDIS_PORT: joi.number(),
    STRIPE_SECRET_KEY: joi.string().required(),
    STRIPE_PUBLISHABLE_KEY: joi.string().required(),
    STRIPE_WEBHOOK_SECRET: joi.string().required(),
    STRIPE_BASIC_PRICE_ID: joi.string().required(),
    STRIPE_PRO_PRICE_ID: joi.string().required(),
    STRIPE_ELITE_PRICE_ID: joi.string().required(),
    CLIENT_URL: joi.string().uri().required(),
    NOTIFICATION_SERVICE_URL: joi.string().uri().required(),
  })
  .unknown(true);

const { error, value } = envSchema.validate(process.env, { abortEarly: false });

if (error) {
  const details = error.details.map((d) => d.message).join(', ');
  console.error(`❌ Invalid environment configuration: ${details}`);
  process.exit(1);
}

export default value as {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  CORS_ORIGIN: string;
  MONGODB_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  REDIS_USERNAME: string;
  REDIS_PASSWORD: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_BASIC_PRICE_ID: string;
  STRIPE_PRO_PRICE_ID: string;
  STRIPE_ELITE_PRICE_ID: string;
  CLIENT_URL: string;
  NOTIFICATION_SERVICE_URL: string;
};