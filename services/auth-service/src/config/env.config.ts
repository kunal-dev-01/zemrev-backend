import joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = joi
  .object({
    PORT: joi.number().default(5000),
    NODE_ENV: joi.string().valid('development', 'production', 'test').default('development'),
    CORS_ORIGIN: joi.string().uri().required(),
    MONGODB_URL: joi.string().uri().required(),
    GOOGLE_CLIENT_ID: joi.string().required(),
    GOOGLE_CLIENT_SECRET: joi.string().required(),
    GOOGLE_REDIRECT_URI: joi.string().uri().required(),
    JWT_ACCESS_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    REDIS_USERNAME: joi.string(),
    REDIS_PASSWORD: joi.string(),
    REDIS_HOST: joi.string(),
    REDIS_PORT: joi.number(),
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
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  REDIS_USERNAME: string;
  REDIS_PASSWORD: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  CLIENT_URL: string;
  NOTIFICATION_SERVICE_URL: string;
};