import admin from "firebase-admin";
import fs from "node:fs";
import { resolveWorkspacePath } from "./runtime-paths.js";

const parseServiceAccount = (raw: unknown): admin.ServiceAccount => {
  const source =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const projectId =
    typeof source.project_id === "string" ? source.project_id : "";
  const clientEmail =
    typeof source.client_email === "string" ? source.client_email : "";
  const privateKeyRaw =
    typeof source.private_key === "string" ? source.private_key : "";

  return {
    projectId,
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
  };
};

const loadServiceAccount = (baseDir: string): admin.ServiceAccount => {
  const serviceAccountJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
  const serviceAccountPath = process.env.FIREBASE_ADMIN_CREDENTIALS;

  if (serviceAccountJson) {
    return parseServiceAccount(JSON.parse(serviceAccountJson));
  }

  if (!serviceAccountPath) {
    throw new Error(
      "Set FIREBASE_ADMIN_CREDENTIALS_JSON or FIREBASE_ADMIN_CREDENTIALS",
    );
  }

  const resolvedPath = resolveWorkspacePath(baseDir, serviceAccountPath);
  const fileContents = fs.readFileSync(resolvedPath, "utf8");
  return parseServiceAccount(JSON.parse(fileContents));
};

export const initializeFirebaseServices = (baseDir: string) => {
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount(baseDir);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log("[firebase-admin] initialized");
  }

  return {
    db: admin.firestore(),
    bucket: admin.storage().bucket(),
  };
};

export const runStartupFirestoreCheck = async (
  db: FirebaseFirestore.Firestore,
): Promise<void> => {
  try {
    await db.collection("system").limit(1).get();
    console.log("[firebase-admin] startup firestore check: ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[firebase-admin] startup firestore check failed:", message);
  }
};
