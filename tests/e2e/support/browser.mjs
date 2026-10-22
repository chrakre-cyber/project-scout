// TESTHJELPER (CI-001 trinn 2): starter nettleseren for e2e-skriptene.
//  - Standard: `playwright-core` (devDependency) + en FORHÅNDSINSTALLERT Chrome/Chromium (CHROME_PATH, ellers kjente stier). Ingenting lastes ned eller installeres;
//    finnes ingen nettleser, avsluttes skriptet med exit-kode 3 og meldingen «IKKE KJØRT» (aldri som bestått).
//  - Bakoverkompatibelt: er PW satt (sti til en full `playwright`-pakke, slik de gamle sandbox-skriptene bruker), brukes den pakkens egne nettlesere som før.
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
export const NOT_RUN_EXIT = 3;

const FIXED = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/opt/google/chrome/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
export function findChrome(env = process.env, exists = existsSync, list = readdirSync) {
  if (env.CHROME_PATH) return exists(env.CHROME_PATH) ? env.CHROME_PATH : null;
  for (const p of FIXED) if (exists(p)) return p;
  const pw = env.PLAYWRIGHT_BROWSERS_PATH;
  if (pw && exists(pw)) {
    for (const d of list(pw).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      const c = path.join(pw, d, "chrome-linux", "chrome");
      if (exists(c)) return c;
    }
  }
  return null;
}

export async function launchBrowser() {
  if (process.env.PW && !process.env.CHROME_PATH) return require(process.env.PW).chromium.launch();
  const exe = findChrome();
  if (!exe) {
    console.log("IKKE KJØRT: ingen forhåndsinstallert Chrome/Chromium funnet (sett CHROME_PATH). Ingenting installeres automatisk; dette er IKKE en bestått kontroll.");
    process.exit(NOT_RUN_EXIT);
  }
  const { chromium } = require("playwright-core");
  return chromium.launch({ executablePath: exe, headless: true });
}
