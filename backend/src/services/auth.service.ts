import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { UserRole } from '../contracts/index.js';
import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../contracts/index.js';

type FirebaseLoginSuccess = {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
};

type FirebaseLoginError = {
  error?: {
    message?: string;
  };
};

export class InvalidLoginCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidLoginCredentialsError';
  }
}

export class LoginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginConfigurationError';
  }
}

export class LoginForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginForbiddenError';
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super('An account with this email already exists');
    this.name = 'EmailAlreadyInUseError';
  }
}

export class RegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistrationError';
  }
}

const isUserRole = (value: unknown): value is UserRole => {
  return value === UserRole.ADMIN || value === UserRole.SECURITY || value === UserRole.STUDENT;
};

const getFirebaseApiKey = (): string => {
  const apiKey = process.env.FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    throw new LoginConfigurationError('FIREBASE_API_KEY is required for backend login');
  }

  return apiKey;
};

type ResolvedUserProfile = {
  role: UserRole;
  displayName: string | null;
  trusted: boolean;
};

const resolveUserProfile = async (db: Firestore, uid: string): Promise<ResolvedUserProfile> => {
  const authUser = await admin.auth().getUser(uid);
  const claimRole = authUser.customClaims?.['role'];

  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data() ?? {};
  const storedRole = userData['role'];
  const role = isUserRole(claimRole) ? claimRole : isUserRole(storedRole) ? storedRole : null;

  if (role) {
    const displayName =
      typeof userData['displayName'] === 'string'
        ? userData['displayName']
        : typeof authUser.displayName === 'string'
          ? authUser.displayName
          : null;

    return {
      role,
      displayName,
      trusted: Boolean(userData['trusted']),
    };
  }

  throw new LoginForbiddenError('This account is not authorized to sign in here');
};

const mapFirebaseErrorToDomainError = (errorCode: string | undefined): Error => {
  switch (errorCode) {
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
      return new InvalidLoginCredentialsError();
    case 'USER_DISABLED':
      return new LoginForbiddenError('This account has been disabled');
    default:
      return new LoginConfigurationError('Login provider is unavailable');
  }
};

export const loginUser = async (
  db: Firestore,
  payload: LoginRequest,
): Promise<LoginResponse> => {
  const apiKey = getFirebaseApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        returnSecureToken: true,
      }),
    },
  );

  const responseBody = await response.json() as FirebaseLoginSuccess | FirebaseLoginError;
  if (!response.ok) {
    throw mapFirebaseErrorToDomainError((responseBody as FirebaseLoginError).error?.message);
  }

  const login = responseBody as FirebaseLoginSuccess;
  const profile = await resolveUserProfile(db, login.localId);

  return {
    idToken: login.idToken,
    refreshToken: login.refreshToken,
    expiresIn: Number.parseInt(login.expiresIn, 10),
    user: {
      uid: login.localId,
      email: login.email,
      displayName: profile.displayName,
      role: profile.role,
      trusted: profile.role === UserRole.STUDENT ? profile.trusted : undefined,
    },
  };
};

export const revokeStaffSession = async (uid: string): Promise<void> => {
  await admin.auth().revokeRefreshTokens(uid);
};

const TRUSTED_DOMAINS = ['fanshaweonline.ca', 'fanshawec.ca'] as const;

const isTrustedEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return (TRUSTED_DOMAINS as readonly string[]).includes(domain);
};

export const registerStudentUser = async (
  db: Firestore,
  payload: RegisterRequest,
): Promise<RegisterResponse> => {
  const apiKey = getFirebaseApiKey();
  const trusted = isTrustedEmail(payload.email);

  // Create Firebase Auth user (Admin SDK — never returns a session token)
  let uid: string;
  try {
    const userRecord = await admin.auth().createUser({
      email: payload.email,
      password: payload.password,
      ...(payload.displayName ? { displayName: payload.displayName } : {}),
    });
    uid = userRecord.uid;
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/email-already-exists') {
      throw new EmailAlreadyInUseError();
    }
    throw new RegistrationError('Account creation failed');
  }

  // Stamp STUDENT role + trusted flag as custom claims
  await admin.auth().setCustomUserClaims(uid, { role: UserRole.STUDENT, trusted });

  // Persist user document in Firestore
  await db.collection('users').doc(uid).set({
    uid,
    email: payload.email,
    displayName: payload.displayName ?? null,
    role: UserRole.STUDENT,
    trusted,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Sign the new user in via REST API to obtain a fresh idToken
  const signInResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: payload.email, password: payload.password, returnSecureToken: true }),
    },
  );

  const signInBody = await signInResponse.json() as FirebaseLoginSuccess | FirebaseLoginError;
  if (!signInResponse.ok) {
    throw new RegistrationError('Account created but sign-in failed');
  }

  const login = signInBody as FirebaseLoginSuccess;
  return {
    idToken: login.idToken,
    refreshToken: login.refreshToken,
    expiresIn: Number.parseInt(login.expiresIn, 10),
    user: {
      uid,
      email: payload.email,
      displayName: payload.displayName ?? null,
      role: UserRole.STUDENT,
      trusted,
    },
  };
};
