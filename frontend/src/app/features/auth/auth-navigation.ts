import { UserRole } from '../../models';

const ALLOWED_AUTH_RETURN_PATHS = ['/claim-request', '/found-items', '/items', '/admin'];

export function sanitizeAuthReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/[a-zA-Z][a-zA-Z\d+\-.]*:/.test(raw)) return null;

  const path = raw.split('?')[0];
  const allowed = ALLOWED_AUTH_RETURN_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return allowed ? raw : null;
}

export function sanitizeStudentReturnUrl(raw: string | null): string {
  return sanitizeAuthReturnUrl(raw) ?? fallbackStudentPath();
}

export function resolvePostLoginPath(role: UserRole, returnUrl: string | null): string {
  const sanitizedReturnUrl = sanitizeAuthReturnUrl(returnUrl);
  if (sanitizedReturnUrl) {
    if (role === UserRole.ADMIN || role === UserRole.SECURITY) {
      return sanitizedReturnUrl;
    }

    return sanitizeStudentReturnUrl(sanitizedReturnUrl);
  }

  return resolveRoleHomePath(role);
}

export function resolveRoleHomePath(role: UserRole): string {
  if (role === UserRole.ADMIN || role === UserRole.SECURITY) {
    return '/admin/dashboard';
  }

  return fallbackStudentPath();
}

function fallbackStudentPath(): string {
  return '/claim-request';
}
