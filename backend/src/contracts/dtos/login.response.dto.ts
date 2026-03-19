import type { UserRole } from '../enums/user-role.enum.js';

export type LoginResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    uid: string;
    email: string;
    displayName?: string | null;
    role: UserRole;
    trusted?: boolean;
  };
};
