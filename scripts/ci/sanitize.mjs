// Sanering av tekst før den kan nå en offentlig Actions-logg, jobbsammendrag eller artefakt (repoet er offentlig).
// Bruk: node scripts/ci/sanitize.mjs [--literals <fil>]          stdin → stdout (erstatter mønstre og eksakte hemmeligheter)
//       node scripts/ci/sanitize.mjs --check [--literals <fil>]  exit 1 hvis stdin inneholder noe som ville blitt redigert
// Eksakte verdier (f.eks. nøkler lest fra den lokale stakken) legges i --literals (én per linje; verdier under 8 tegn ignoreres).
import { readFileSync } from "node:fs";

const MAX_LINE = 400;
const NAMED = "ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|SECRET_KEY|PUBLISHABLE_KEY|DB_URL|DATABASE_URL|S3_ACCESS_KEY|S3_SECRET_KEY|PGPASSWORD|PASSWORD|PASSORD|PASSWD|TOKEN|API_KEY|APIKEY|SECRET";

/** Mønstre i rekkefølge; hver er [regex, erstatning]. */
export const PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}(?:\.[A-Za-z0-9_-]*)?/g, "[REDACTED:jwt]"],
  [/sb_(?:secret|publishable)_[A-Za-z0-9_-]{6,}/g, "[REDACTED:supabase-key]"],
  [/\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@]+@\S*/gi, "[REDACTED:url-with-credentials]"],
  [/\bpostgres(?:ql)?:\/\/\S+/gi, "[REDACTED:db-url]"],
  [new RegExp(`\\b([A-Za-z0-9_]*(?:${NAMED}))\\s*[:=]\\s*"?(?!\\[REDACTED)[^\\s"]+"?`, "gi"), "$1=[REDACTED]"],
  [/\bBearer\s+(?!\[REDACTED)\S+/gi, "Bearer [REDACTED]"],
  [/\bAuthorization:\s*(?!\[REDACTED)\S+(?:\s+\S+)?/gi, "Authorization: [REDACTED]"],
  [/\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}/g, "[REDACTED:token]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "[REDACTED:private-key]"],
  [/[A-Za-z0-9_+/=-]{40,}/g, "[REDACTED:long-token]"],
];

export function loadLiterals(file) {
  if (!file) return [];
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { return []; }
  return [...new Set(text.split(/\r?\n/).filter((v) => v.length >= 8))].sort((a, b) => b.length - a.length);
}

export function sanitizeText(text, literals = []) {
  let out = String(text);
  for (const lit of literals) out = out.split(lit).join("[REDACTED:literal]");
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out.split("\n").map((l) => (l.length > MAX_LINE ? `${l.slice(0, MAX_LINE)} […avkortet]` : l)).join("\n");
}

/** Sant hvis teksten inneholder noe sanering ville endret (unntatt avkorting). */
export function hasLeak(text, literals = []) {
  const t = String(text);
  for (const lit of literals) if (t.includes(lit)) return true;
  for (const [re] of PATTERNS) { re.lastIndex = 0; if (re.test(t)) { re.lastIndex = 0; return true; } }
  return false;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  const li = args.indexOf("--literals");
  const literals = li >= 0 ? loadLiterals(args[li + 1]) : [];
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  if (args.includes("--check")) process.exit(hasLeak(input, literals) ? 1 : 0);
  process.stdout.write(sanitizeText(input, literals));
}
