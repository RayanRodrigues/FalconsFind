import type { Response } from 'express';
import type { ErrorResponse } from '../contracts/index.js';

export const API_PREFIX = '/api/v1';

export const sendError = (res: Response, status: number, code: string, message: string): void => {
  const payload: ErrorResponse = {
    error: {
      code,
      message,
    },
  };

  res.status(status).json(payload);
};
