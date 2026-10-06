#!/usr/bin/env bash
# QA-001: søker repo, git-historikk, build-artefakter og rapporter etter hemmeligheter.
# Skriver aldri ut selve verdiene, bare filnavn og antall treff. Exit-kode ≠ 0 ved uforklarlige treff.
set -uo pipefail
cd "$(dirname "$0")/.."
fails=0
report() { # navn antall forventet
  if [ "$2" -eq "$3" ]; then echo "PASS  $1 (0 treff)"; else echo "FAIL  $1 ($2 treff, forventet $3)"; fails=$((fails+1)); fi
}
SECRET_PATTERNS='sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}|postgres(ql)?://[^[:space:]:@/]+:[^[:space:]@]{3,}@|SERVICE_ROLE_KEY\s*=\s*\S+|PGPASSWOR[D]=[^[:space:]]+|Authorization:\s*Basic\s+[A-Za-z0-9+/=]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{20,}'
# Publishable key er offentlig av design, men skal likevel ikke ligge i git eller klientbundle.
PATTERNS="sb_publishable_[A-Za-z0-9_-]{8,}|$SECRET_PATTERNS"

echo "== Git-konfigurasjon"
check_ignored() { git check-ignore -q "$1" && echo "PASS  $1 er gitignorert" || { echo "FAIL  $1 er IKKE gitignorert"; fails=$((fails+1)); }; }
check_ignored .env.local; check_ignored .env; check_ignored .next/x; check_ignored supabase/.temp/x
report "sporede env-filer (utenom .env.example)" "$(git ls-files | grep -E '(^|/)\.env' | grep -v '\.env\.example$' | wc -l)" 0
report ".env.local aldri i git-historikken" "$(git log --all --oneline -- .env.local .env | wc -l)" 0
echo "== .env.example: bare tomme verdier/kommentarer"
report ".env.example har ingen verdier etter =" "$(grep -E '^[A-Z_]+=.+' .env.example | wc -l)" 0

echo "== Mønstersøk"
report "sporede filer" "$(git ls-files -z | xargs -0 grep -I -l -E "$PATTERNS" 2>/dev/null | wc -l)" 0
report "full git-historikk (alle commits, alle grener)" "$(git log --all -p | grep -c -E "$PATTERNS")" 0
report "untracked, ikke-ignorerte filer" "$(git ls-files -o --exclude-standard -z | xargs -0 -r grep -I -l -E "$PATTERNS" 2>/dev/null | wc -l)" 0
report "reviews/*.md (rapporter)" "$(grep -l -E "$PATTERNS" reviews/*.md 2>/dev/null | wc -l)" 0
if [ -d .next ]; then
  report "build-artefakter .next/static (klient)" "$(grep -r -l -E "$PATTERNS" .next/static 2>/dev/null | wc -l)" 0
  # Publishable key er offentlig av design og inlines fra NEXT_PUBLIC_* i serverbundelen. Alt annet skal ikke finnes der.
  report "build-artefakter .next/server (server, utenom publishable key)" "$(grep -r -l -E "$SECRET_PATTERNS" .next/server 2>/dev/null | wc -l)" 0
else echo "SKIP  .next finnes ikke (kjør npm run build først)"; fi

echo "== Ordsøk i klientkode og klientbundle"
report "«service_role» / «sb_secret» i src/" "$(grep -r -l -E 'service_role|sb_secret|SERVICE_ROLE' src 2>/dev/null | wc -l)" 0
[ -d .next/static ] && report "«service_role» / «sb_secret» i klientbundle" "$(grep -r -l -E 'service_role|sb_secret|SERVICE_ROLE' .next/static 2>/dev/null | wc -l)" 0
report "mobile.de/sandbox-credentials i repo (Basic-auth, api-key, passord)" "$(git ls-files -z | xargs -0 grep -I -i -l -E 'mobile[._-]?de.*(password|passord|api[_-]?key|secret|token)\s*[:=]\s*["'"'"']?[A-Za-z0-9]{6,}' 2>/dev/null | wc -l)" 0

echo "== Faktiske lokale nøkkelverdier (skrives ikke ut)"
if st="$(npx supabase status -o env 2>/dev/null)" && [ -n "$st" ]; then
  for v in SECRET_KEY SERVICE_ROLE_KEY JWT_SECRET ANON_KEY PUBLISHABLE_KEY; do
    val="$(printf '%s\n' "$st" | sed -n "s/^$v=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p")"
    [ -z "$val" ] && { echo "SKIP  $v ikke tilgjengelig"; continue; }
    tracked="$(git ls-files -z | xargs -0 grep -I -l -F -- "$val" 2>/dev/null | wc -l)"
    hist="$(git log --all -p | grep -c -F -- "$val")"
    # Publishable/anon-nøkkel er offentlig og forventes i klientbundelen; alle andre skal aldri være der.
    # Publishable/anon-nøkkel er offentlig; i klient- og serverbundle er den ikke et funn. Alle andre skal aldri være i bundlene.
    if [ "$v" = "PUBLISHABLE_KEY" ] || [ "$v" = "ANON_KEY" ]; then bundle=0
    else bundle="$( [ -d .next ] && grep -r -l -F -- "$val" .next 2>/dev/null | wc -l)"; fi
    report "$v i sporede filer/historikk/build-artefakter" "$((tracked + hist + bundle))" 0
  done
else echo "SKIP  lokal Supabase kjører ikke"; fi
echo
[ "$fails" -eq 0 ] && echo "SECRET-SKANN: INGEN FUNN" || echo "SECRET-SKANN: $fails KONTROLL(ER) MED FUNN"
exit "$fails"
