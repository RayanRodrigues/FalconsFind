import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const workspaceRootsFor = (baseDir: string): string[] => [
  path.resolve(baseDir, ".."),
  path.resolve(baseDir, "../.."),
];

export const resolveWorkspacePath = (
  baseDir: string,
  targetPath: string,
): string => {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  const existing = workspaceRootsFor(baseDir)
    .map((rootPath) => path.resolve(rootPath, targetPath))
    .find((candidate) => fs.existsSync(candidate));

  return existing ?? path.resolve(workspaceRootsFor(baseDir)[0], targetPath);
};

export const loadEnvironment = (baseDir: string): void => {
  const envPath = workspaceRootsFor(baseDir)
    .map((rootPath) => path.resolve(rootPath, ".env"))
    .find((candidate) => fs.existsSync(candidate));

  dotenv.config(envPath ? { path: envPath } : undefined);
};
