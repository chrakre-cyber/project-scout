# ECON-004 — satsvedtak og meldingsformat

Kontroller manifestets SHA-256 og byte, og registrer kildeidentitet og proveniens. Ingen kodeendringer eller godkjenninger i denne runden.

1. Les Stortingets vedtak 217 §§ 1–2 og Lovtidends FOR-2025-12-18-2752. § 2 angir 25 prosent også ved innførsel. Avstem ordlyd og dokumentidentitet. Oppdater R-IMP-VAT-001 med faktisk kildebelegg. Originalvedtak dokumenterer ikke alene fravær av senere endringsvedtak.
2. Les XSD-filen og dokumentasjonssiden sammen. `grunnlag`, `merverdiavgift` og `fastsattMerverdiavgift` bruker `Beloep`, som bygger på `Desimaltall`, som igjen begrenser `xsd:decimal`. Skill at desimalformat aksepteres i skjemaet fra en rettslig avrundingsregel og eventuelle strengere servervalideringer. Skjemaet alene gir ikke half-up, floor per import eller tidspunkt for avrunding. Dette er v1.0 fra en bevegelig master-gren, hentet med hash; gyldighet og eventuell nyere modell må ikke antas uten kontroll.
3. Oppdater U-013 del C med det formatbelegget som faktisk følger av denne XSD-en. Hold beregningsmetode, rapporteringsformat og samlet betalingskrav atskilt. Ikke løft alle U-013-delspørsmål samlet, og ikke endre ECON-003-literalene.
4. Gjør de seks foreslåtte registerrettelsene fra kildevurdering 3 der de er faktiske kilde-/sporbarhetsrettelser. Ta hensyn til at den tidligere mangelen på satsbelegg nå har fått nytt underlag. Evidensklassifisering skal følge lest tekst og avgrensede påstander, ikke vente på en brukerbeslutning om hva teksten sier. Skille evidensnivå fra parametergodkjenning. Del for brede regler hvis nødvendig fremfor å løfte udekkede delpåstander.
5. Rett eldre oversikter med henvisning til nyere funn uten å slette historisk sporbarhet. R-OTA-014 får bare overvåkingsnotat; ECON-002-godkjenningen og runtime er uendret.
6. Lever en kort rapport med konkrete registerendringer og resterende spørsmål som faktisk blokkerer et avgrenset ECON-004-omfang. Ingen ny stor gjentakelse av allerede besvarte bestillinger.

Alle økonomiflagg forblir false. Ingen produktkonvensjon, omfangsendring eller parametergodkjenning gis her. ECON-004 står på REVIEW, ECON-005 skal ikke startes.
