import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

function loadCustomEnvFile(filename: string) {
  const filePath = path.join(process.cwd(), "..", filename);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (!process.env[key]) {
      process.env[key] = unquoted;
    }
  }
}

if (process.env.ENV_FILE) {
  loadCustomEnvFile(process.env.ENV_FILE);
} else if (process.env.NODE_ENV === "production") {
  loadCustomEnvFile(".env.prod");
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
