import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let hasLoadedEnv = false;

const ENV_FILES = ['.env.local', '.env'];

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(filePath: string) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = line.slice(separatorIndex + 1).trim();
    process.env[key] = stripWrappingQuotes(value);
  }
}

export function ensureLocalEnvLoaded() {
  if (hasLoadedEnv) {
    return;
  }

  for (const envFile of ENV_FILES) {
    const filePath = resolve(process.cwd(), envFile);

    if (existsSync(filePath)) {
      loadEnvFile(filePath);
    }
  }

  hasLoadedEnv = true;
}
