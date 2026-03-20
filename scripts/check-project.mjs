import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const root = process.cwd();
const srcDir = path.join(root, "frontend", "src");

const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const sourceExts = new Set(exts);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function tryResolve(basePath) {
  const candidates = [
    basePath,
    ...exts.map(ext => basePath + ext),
    ...exts.map(ext => path.join(basePath, "index" + ext)),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function extractImports(content) {
  const matches = [];
  const patterns = [
    /import\s+[^'"]*?from\s+['"]([^'"]+)['"]/g,
    /import\s*?\(\s*?['"]([^'"]+)['"]\s*?\)/g,
    /export\s+[^'"]*?from\s+['"]([^'"]+)['"]/g,
  ];
  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      matches.push(m[1]);
    }
  }
  return matches;
}

function rel(p) {
  return path.relative(root, p).replace(/\\/g, "/");
}

console.log("\n=== 1) Missing relative imports ===\n");

const files = walk(srcDir).filter(f => sourceExts.has(path.extname(f)));
let missingCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const imports = extractImports(content);

  for (const imp of imports) {
    if (!imp.startsWith(".") && !imp.startsWith("/")) continue; // package import
    const resolved = tryResolve(path.resolve(path.dirname(file), imp));
    if (!resolved) {
      missingCount++;
      console.log(`MISSING: ${rel(file)}  ->  ${imp}`);
    }
  }
}

if (missingCount === 0) {
  console.log("No missing relative imports found.");
}

console.log("\n=== 2) Untracked / modified files (local only, not committed yet) ===\n");
try {
  const status = execSync("git status --short", { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  console.log(status || "No local changes.");
} catch (e) {
  console.log("Could not read git status.");
}

console.log("\n=== 3) Commits/files not pushed to remote branch ===\n");
try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  execSync(`git fetch origin ${branch}`, { stdio: ["ignore", "pipe", "pipe"] });

  const notPushedCommits = execSync(`git log --oneline origin/${branch}..HEAD`, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  const notPushedFiles = execSync(`git diff --name-only origin/${branch}..HEAD`, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

  console.log("Commits not pushed:");
  console.log(notPushedCommits || "No commits waiting to be pushed.");

  console.log("\nFiles changed compared to remote:");
  console.log(notPushedFiles || "No file differences vs remote branch.");
} catch (e) {
  console.log("Could not compare with remote branch. Make sure git remote exists and branch is pushed at least once.");
}

console.log("\n=== 4) Optional TypeScript check ===\n");
console.log("Run this manually:");
console.log("cd frontend && npx tsc --noEmit");
