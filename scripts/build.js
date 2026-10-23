const path = require("path");
const { spawnSync } = require("child_process");

// Plesk's "Run Node.js commands" doesn't reliably keep cwd at the app root,
// which breaks Prisma CLI's relative schema lookup. Resolve everything from
// this script's own absolute location instead (same fix pattern proven in
// the sibling homework-next project's scripts/db-push.js).
const root = path.join(__dirname, "..");
const schemaPath = path.join(root, "prisma", "schema.prisma");

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")} (cwd=${root})`);
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: root });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("npx", ["prisma", "generate", "--schema", schemaPath]);
run("npx", ["next", "build"]);
