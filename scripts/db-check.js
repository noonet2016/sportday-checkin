// Runtime DB connectivity check for Plesk ("Run Node.js commands" → `run db:check`).
// `db:push` goes through Prisma's CLI engine; the running app goes through the
// `mariadb` driver (via @prisma/adapter-mariadb). This reproduces the app's path
// and prints the driver's real error. Read-only: one SELECT, password masked.
const fs = require("fs");
const path = require("path");
const mariadb = require("mariadb");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

let shown = raw;
try {
  const u = new URL(raw);
  if (u.password) u.password = "***";
  shown = u.toString();
  console.log("user:", decodeURIComponent(new URL(raw).username), "| host:", u.hostname, "| port:", u.port || "(default)", "| db:", u.pathname.slice(1), "| params:", u.search || "(none)");
  console.log("password contains special chars:", /[@#:/?&%\s]/.test(decodeURIComponent(new URL(raw).password)) ? "yes (must be %-encoded in the URL)" : "no");
} catch (e) {
  console.error("DATABASE_URL is not a valid URL:", e.message);
}
console.log("url:", shown);

// Same rewrite @prisma/adapter-mariadb applies before handing the URL to the driver.
let driverUrl = raw;
try {
  const u = new URL(raw);
  if (!u.searchParams.has("prepareCacheLength")) u.searchParams.set("prepareCacheLength", "0");
  if (u.protocol === "mysql:") u.protocol = "mariadb:";
  driverUrl = u.toString();
} catch {}

const secret = (() => { try { return decodeURIComponent(new URL(raw).password); } catch { return ""; } })();
const mask = (s) => {
  let out = String(s);
  for (const p of [secret, encodeURIComponent(secret)]) if (p) out = out.split(p).join("***");
  return out;
};

(async () => {
  let conn;
  try {
    conn = await mariadb.createConnection(driverUrl);
    const [v] = await conn.query("SELECT VERSION() AS v");
    const [c] = await conn.query("SELECT COUNT(*) AS n FROM staff");
    console.log("OK — server", v.v, "| staff rows:", String(c.n));
  } catch (e) {
    console.error("FAILED:", e.code || "", e.errno || "", "-", mask(e.message));
  } finally {
    if (conn) await conn.end();
  }
})();
