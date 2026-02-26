type AppEnv = 'development' | 'production';

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

const resolveAppEnv = (): AppEnv => {
  const raw = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase();
  return raw === 'production' ? 'production' : 'development';
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

export const getAppConfig = () => {
  const appEnv = resolveAppEnv();
  return {
    appEnv,
    port: parsePort(process.env.PORT),
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',
    apiBaseUrl: resolveApiBaseUrl(appEnv),
  };
};
