// Innloggingsbudsjett for nettleserløpene mot ekte GoTrue (CI-001 trinn 3). GoTrue begrenser innlogginger per IP (`[auth.rate_limit] sign_in_sign_ups`, 30 per 5 min i supabase/config.toml).
// Testkravene svekkes ikke: i stedet for å redusere antall innlogginger venter orkestreringen til vinduet har rom. Rene funksjoner + liten CLI (brukes av scripts/ci-supabase-local.sh):
//   node scripts/ci/login-budget.mjs record <tilstandsfil> <antall>     legger til «nå, antall» (sekunder siden epoke)
//   node scripts/ci/login-budget.mjs wait   <tilstandsfil> <behov>      skriver antall sekunder å vente før <behov> nye innlogginger er innenfor budsjettet
import { appendFileSync, existsSync, readFileSync } from "node:fs";

export const WINDOW_SEC = 300;
export const LIMIT = 30;
export const HEADROOM = 6; // slingringsmonn for gjentatte forsøk og sjekker som logger inn flere ganger enn planlagt

/** @param {{t:number,n:number}[]} events  @param {number} now  @param {number} need */
export function secondsToWait(events, now, need, { windowSec = WINDOW_SEC, limit = LIMIT, headroom = HEADROOM } = {}) {
  const allowed = limit - headroom - need;
  if (allowed < 0) throw new RangeError(`behovet (${need}) overstiger budsjettet (${limit - headroom}) i ett vindu`);
  const used = (at) => events.filter((e) => e.t > at - windowSec && e.t <= at).reduce((s, e) => s + e.n, 0);
  if (used(now) <= allowed) return 0;
  // Tidligste tidspunkt da nok gamle hendelser har falt ut av vinduet: sjekk ved hver hendelses utløp.
  const expiries = events.map((e) => e.t + windowSec).filter((t) => t > now).sort((a, b) => a - b);
  for (const t of expiries) if (used(t) <= allowed) return Math.ceil(t - now);
  return windowSec;
}

const parse = (file) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { const [t, n] = l.split(" ").map(Number); return { t, n }; }) : []);

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const [cmd, file, arg] = process.argv.slice(2);
  const now = Math.floor(Date.now() / 1000);
  if (cmd === "record") { appendFileSync(file, `${now} ${Number(arg)}\n`); }
  else if (cmd === "wait") { process.stdout.write(`${secondsToWait(parse(file), now, Number(arg))}\n`); }
  else { console.error("bruk: login-budget.mjs record|wait <fil> <tall>"); process.exit(2); }
}
