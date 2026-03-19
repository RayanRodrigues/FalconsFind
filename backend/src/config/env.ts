type AppEnv = 'development' | 'production';
import { resolveAppEnv } from '../utils/app-env.js';

const DEFAULT_DEV_CORS_ORIGINS = ['http://localhost:4200', 'http://localhost:5173', 'http://localhost:3000'];

const parsePort = (value: string | undefined): number => {
  const fallback = 3000;
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return parsed;
};

const resolveApiBaseUrl = (appEnv: AppEnv): string => {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  if (appEnv === 'production') {
    return process.env.API_BASE_URL_PROD ?? 'https://falconsfind.onrender.com';
  }

  return process.env.API_BASE_URL_DEV ?? 'http://localhost:3000';
};

const parseCorsOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const resolveCorsAllowedOrigins = (appEnv: AppEnv): string[] => {
  const explicitOrigins = parseCorsOrigins(
    process.env.CORS_ALLOWED_ORIGINS ??
      (appEnv === 'production'
        ? process.env.CORS_ALLOWED_ORIGINS_PROD
        : process.env.CORS_ALLOWED_ORIGINS_DEV),
  );

  if (explicitOrigins.length > 0) {
    return explicitOrigins;
  }

  if (appEnv === 'production') {
    return [];
  }

  return DEFAULT_DEV_CORS_ORIGINS;
};

export const getAppConfig = () => {
  const appEnv = resolveAppEnv();
  return {
    appEnv,
    port: parsePort(process.env.PORT),
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',
    apiBaseUrl: resolveApiBaseUrl(appEnv),
    corsAllowedOrigins: resolveCorsAllowedOrigins(appEnv),
    redisUrl: process.env.REDIS_URL,
    enableSwagger: appEnv !== 'production',
  };
};
