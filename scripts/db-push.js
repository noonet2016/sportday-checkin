const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");

// Find .env file in the application root (one level up from scripts/)
const envPath = path.join(root, ".env");

if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, "utf8");
  console.log(".env file size:", envContent.length, "bytes");

  if (envContent.startsWith("﻿")) {
    envContent = envContent.slice(1);
  }

  const loadedKeys = [];
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("#")) return;

    const hasEquals = trimmedLine.includes("=");
    const hasColon = trimmedLine.includes(":");
    if (!hasEquals && !hasColon) return;

    const separator = hasEquals ? "=" : ":";
    const [key, ...valueParts] = trimmedLine.split(separator);
    const trimmedKey = key.trim();
    let value = valueParts.join(separator).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[trimmedKey] = value;
    loadedKeys.push(trimmedKey);
  });
  console.log("Successfully loaded environment variables from .env. Keys:", loadedKeys);
} else {
  console.warn(".env file not found at:", envPath);
}

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set in process.env or .env file!");
  console.log("Available environment keys:", Object.keys(process.env).filter(k => !k.startsWith("npm_") && k.length < 30));
  process.exit(1);
}

const acceptDataLoss = process.argv.includes("--accept-data-loss");
const args = ["prisma", "db", "push", "--schema", schemaPath];
if (acceptDataLoss) args.push("--accept-data-loss");

console.log(`> npx ${args.join(" ")} (cwd=${root})`);
const result = spawnSync("npx", args, { stdio: "inherit", cwd: root, env: process.env });
process.exit(result.status || 0);
