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

export const getAppConfig = () => ({
  port: parsePort(process.env.PORT),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
});
