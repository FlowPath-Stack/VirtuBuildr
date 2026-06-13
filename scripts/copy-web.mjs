/* Copies the canonical static web app (repo root) into www/ so Capacitor can
 * bundle it into the native app. www/ is generated and git-ignored. */
import { mkdir, copyFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "www");

const ASSETS = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "icon.svg",
  "sw.js",
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of ASSETS) {
  await copyFile(join(root, file), join(out, file));
}

console.log(`Copied ${ASSETS.length} assets into www/`);
