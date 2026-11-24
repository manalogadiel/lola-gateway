import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { stageHosting } from "../scripts/stage-hosting.mjs";

const firebaseDir = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(path.join(firebaseDir, "firebase.json"), "utf8"));

test("Firebase Hosting serves staged files and rewrites SPA routes", () => {
  const { hosting, emulators } = config;
  assert.ok(hosting, "hosting configuration is required");
  const publicPath = path.relative(firebaseDir, path.resolve(firebaseDir, hosting.public));
  assert.ok(
    publicPath && !path.isAbsolute(publicPath) && publicPath.split(path.sep)[0] !== "..",
    "hosting.public must resolve strictly inside firebase/",
  );
  assert.deepEqual(hosting.ignore, ["firebase.json", "**/.*", "**/node_modules/**"]);
  assert.deepEqual(hosting.predeploy, ["npm run build:hosting"]);
  assert.deepEqual(hosting.rewrites, [{ source: "**", destination: "/index.html" }]);
  assert.deepEqual(emulators.hosting, { host: "127.0.0.1", port: 5000 });
});

test("Firebase Hosting uses Windows-compatible globs and only caches bundled JS and CSS immutably", () => {
  const cacheRules = config.hosting.headers.flatMap(({ glob, headers }) =>
    headers.filter(({ key }) => key.toLowerCase() === "cache-control")
      .map(({ value }) => [glob, value]));

  assert.deepEqual(cacheRules.sort(), [
    ["/", "no-cache"],
    ["/index.html", "no-cache"],
    ["/sw.js", "no-cache"],
    ["/manifest.webmanifest", "no-cache"],
    ["/assets/*.js", "public, max-age=31536000, immutable"],
    ["/assets/*.css", "public, max-age=31536000, immutable"],
  ].sort());
  assert.ok(config.hosting.headers.every(({ headers }) =>
    headers.every(({ key }) => key.toLowerCase() !== "cross-origin-opener-policy")));
});

test("Git ignores the staged public directory", () => {
  const ignore = readFileSync(path.join(firebaseDir, ".gitignore"), "utf8");
  assert.ok(ignore.split(/\r?\n/).includes("public/"));
});

function makeStagingFixture(context) {
  const rootDir = mkdtempSync(path.join(realpathSync(tmpdir()), "lola-hosting-"));
  context.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const firebaseDir = path.join(rootDir, "firebase");
  const webChatDir = path.join(rootDir, "web-chat");
  const publicDir = path.join(firebaseDir, "public");
  const distDir = path.join(webChatDir, "dist");
  mkdirSync(firebaseDir);
  mkdirSync(path.join(distDir, "assets"), { recursive: true });
  return { firebaseDir, webChatDir, publicDir, distDir };
}

test("Staging copies the build and removes stale files on the next run", (context) => {
  const { firebaseDir, webChatDir, distDir, publicDir } = makeStagingFixture(context);
  const buildFiles = {
    "index.html": "<html>first build</html>",
    "sw.js": "self.skipWaiting();",
    "manifest.webmanifest": '{"name":"Lola"}',
    "assets/index-first.js": "export {};",
    "assets/index-first.css": "body {}",
  };
  for (const [filePath, content] of Object.entries(buildFiles)) {
    writeFileSync(path.join(distDir, filePath), content);
  }
  stageHosting({ firebaseDir, webChatDir, skipBuild: true });
  for (const [filePath, content] of Object.entries(buildFiles)) {
    assert.equal(readFileSync(path.join(publicDir, filePath), "utf8"), content);
  }

  rmSync(path.join(distDir, "assets/index-first.js"));
  writeFileSync(path.join(distDir, "assets/index-next.js"), "export const next = true;");
  writeFileSync(path.join(distDir, "index.html"), "<html>next build</html>");
  stageHosting({ firebaseDir, webChatDir, skipBuild: true });

  assert.equal(readFileSync(path.join(publicDir, "index.html"), "utf8"), "<html>next build</html>");
  assert.equal(readFileSync(path.join(publicDir, "assets/index-next.js"), "utf8"), "export const next = true;");
  assert.throws(() => readFileSync(path.join(publicDir, "assets/index-first.js")), { code: "ENOENT" });
});

test("Staging preserves the previous public directory when dist/index.html is missing", (context) => {
  const { firebaseDir, webChatDir, distDir, publicDir } = makeStagingFixture(context);
  mkdirSync(publicDir);
  writeFileSync(path.join(publicDir, "index.html"), "<html>previous build</html>");
  writeFileSync(path.join(distDir, "sw.js"), "self.skipWaiting();");

  assert.throws(() => stageHosting({ firebaseDir, webChatDir, skipBuild: true }), /missing build file .*index\.html/);
  assert.deepEqual(readdirSync(publicDir), ["index.html"]);
  assert.equal(readFileSync(path.join(publicDir, "index.html"), "utf8"), "<html>previous build</html>");
});
