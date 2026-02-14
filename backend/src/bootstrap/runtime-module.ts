import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const importRuntimeModule = async <T>(
  baseDir: string,
  modulePathWithoutExtension: string,
): Promise<T> => {
  const tsPath = path.resolve(baseDir, `${modulePathWithoutExtension}.ts`);
  const jsPath = path.resolve(baseDir, `${modulePathWithoutExtension}.js`);
  const runtimePath = fs.existsSync(tsPath) ? tsPath : jsPath;
  return (await import(pathToFileURL(runtimePath).href)) as T;
};
