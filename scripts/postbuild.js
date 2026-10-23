const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`copied ${src} -> ${dest}`);
}

copyDir(path.join(root, "public"), path.join(root, ".next", "standalone", "public"));
copyDir(path.join(root, ".next", "static"), path.join(root, ".next", "standalone", ".next", "static"));
