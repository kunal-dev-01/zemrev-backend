import joi from "joi";

const envSchema = joi
  .object({
    PORT: joi.number().default(5000),
    NODE_ENV: joi.string().valid("development", "production", "test").default("development"),
    CORS_ORIGIN: joi.string().required(),
    MONGODB_URL: joi.string().uri().required(),
    GOOGLE_CLIENT_ID: joi.string().required(),
    GOOGLE_CLIENT_SECRET: joi.string().required(),
    GOOGLE_REDIRECT_URI: joi.string().uri().required(),
    JWT_ACCESS_SECRET: joi.string().required(),
    JWT_REFRESH_SECRET: joi.string().required(),
    REDIS_USERNAME: joi.string().default("redis://localhost:6379"),
    REDIS_PASSWORD: joi.string().default(""),
    REDIS_HOST: joi.string().default("localhost"),
    REDIS_PORT: joi.number().default(6379),
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

export const validateEnv = (env: NodeJS.ProcessEnv) => {
  const { error, value } = envSchema.validate(env, { abortEarly: false });

  if (error) {
    const details = error.details.map((d) => d.message).join(", ");
    throw new Error(`❌ Invalid environment configuration: ${details}`);
  }

  return value;
};
