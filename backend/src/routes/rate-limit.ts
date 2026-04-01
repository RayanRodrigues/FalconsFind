import rateLimit from 'express-rate-limit';

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  message: string;
  code?: string;
};

export const createJsonRateLimiter = ({
  windowMs,
  limit,
  message,
  code = 'RATE_LIMITED',
}: RateLimitOptions) => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code,
      message,
    },
  },
});
