import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ErrorResponse } from '../contracts/index.js';
import { HttpError } from '../routes/route-utils.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const payload: ErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  };
  res.status(404).json(payload);
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    const payload: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    res.status(error.status).json(payload);
    return;
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error';
  const payload: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
    },
  };
  res.status(500).json(payload);
};
