export type RuntimeAppEnv = 'development' | 'production';

export const resolveAppEnv = (): RuntimeAppEnv => {
  const raw = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase();
  return raw === 'production' ? 'production' : 'development';
};

export const isProductionApp = (): boolean => resolveAppEnv() === 'production';

export const resolveSourceEnv = (): RuntimeAppEnv => resolveAppEnv();
