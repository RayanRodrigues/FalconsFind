import { HttpError } from './route-utils.js';

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false; error: { issues: Array<{ message?: string }> } };
type SafeParseSchema<T> = {
  safeParse: (input: unknown) => SafeParseSuccess<T> | SafeParseFailure;
};

export const parseBodyOrThrow = <T>(schema: SafeParseSchema<T>, input: unknown): T => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request payload';
    throw new HttpError(400, 'BAD_REQUEST', message);
  }

  return parsed.data;
};
