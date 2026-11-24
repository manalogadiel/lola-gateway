import { spawnSync } from "node:child_process";
import { cpSync, realpathSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function stageHosting({ firebaseDir, webChatDir, skipBuild = false }) {
  if (!skipBuild) {
    const options = { cwd: webChatDir, stdio: "inherit" };
    const result = process.platform === "win32"
      ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm run build"], options)
      : spawnSync("npm", ["run", "build"], options);
    if (result.error) {
      throw new Error(`Could not start npm run build in ${webChatDir}: ${result.error.message}`, { cause: result.error });
    }
    if (result.status !== 0) {
      throw new Error(`npm run build failed in ${webChatDir} (${result.signal ?? `exit code ${result.status}`})`);
    }
  }

  const distDir = path.resolve(webChatDir, "dist");
  const indexPath = path.join(distDir, "index.html");
  if (!statSync(indexPath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Cannot stage Hosting: missing build file ${indexPath}`);
  }

  const publicDir = path.join(realpathSync(firebaseDir), "public");
  rmSync(publicDir, { recursive: true, force: true });
  cpSync(distDir, publicDir, { recursive: true });
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const firebaseDir = path.resolve(path.dirname(scriptPath), "..");
  stageHosting({
    firebaseDir,
    webChatDir: path.resolve(firebaseDir, "../web-chat"),
    skipBuild: process.argv.includes("--skip-build", 2),
  });
}
