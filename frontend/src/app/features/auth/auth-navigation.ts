import { UserRole } from '../../models';

const ALLOWED_STUDENT_PATHS = ['/claim-request', '/found-items', '/items'];

export function sanitizeStudentReturnUrl(raw: string | null): string {
  const fallback = '/claim-request';
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (/[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) return fallback;

  const path = raw.split('?')[0];
  const allowed = ALLOWED_STUDENT_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return allowed ? raw : fallback;
}

export function resolvePostLoginPath(role: UserRole, returnUrl: string | null): string {
  if (role === UserRole.ADMIN || role === UserRole.SECURITY) {
    return '/admin/dashboard';
  }

  return sanitizeStudentReturnUrl(returnUrl);
}
