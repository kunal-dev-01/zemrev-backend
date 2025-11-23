// ====================================
// src/config/env.config.ts
// ====================================

import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = Joi.object({
  PORT: Joi.number().default(5000),
  AUTH_SERVICE_URL: Joi.string().uri().required(),
  USER_SERVICE_URL: Joi.string().uri().required(),
  CORS_ORIGIN: Joi.string().optional(),
  NODE_ENV: Joi.string().default("development")
}).unknown();

const { error, value: env } = envSchema.validate(process.env);
if (error) throw new Error(`Invalid ENV: ${error.message}`);

export default env;