# TAX-001A — profilmatrise og forslag til datakontrakt

Forskningsdato 15.10.2026. **Forslag/dokumentasjon**; ingen profil er støttet. Alle profiler står som `krever_avklaring`.

## 1. Fire adskilte lag
1. **Registreringsønske** (forhandlerens ønske): personbil / varebil / uavklart (`PlannedRegistration` i søkemodellen).
2. **Dokumentert kjøretøyklasse:** M1/N1 mv. fra typegodkjenning/vognkort/Statens vegvesen – ikke utledet av karosseri.
3. **Norsk avgiftsgruppe:** a (personbil, varebil klasse 1), b (varebil klasse 2) o.a. – fastsettes av Statens vegvesen/Skatteetaten.
4. **Godkjent beregningsprofil:** en versjonert regelprofil med E1-kilder og uavhengig referanse. **Ingen finnes.**

SUV-/van-karosseri alene beviser ikke lag 2–4. Valg av «varebil» alene endrer aldri et beløp og gir ingen avgiftsfordel.

## 2. Matrise 2 × 5
| Profil | Kjøretøy | Drivlinje | Relevans | Gruppe | Regler | Status |
|---|---|---|---|---|---|---|
| PB-BEN | personbil | bensin | relevant | a | R-OTA-001, R-OTA-002, R-OTA-003, R-OTA-004, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001, R-IMP-OTH-001, R-IMP-OTH-002, R-DED-001 | krever_avklaring |
| PB-DIE | personbil | diesel | relevant | a | R-OTA-001, R-OTA-002, R-OTA-003, R-OTA-004, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001, R-IMP-OTH-001, R-IMP-OTH-002, R-DED-001 | krever_avklaring |
| PB-HEV | personbil | ikke-ladbar hybrid | relevant | a (antatt behandlet som forbrenningsbil – uavklart) | R-OTA-001, R-OTA-002, R-OTA-006, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001, R-IMP-OTH-001, R-IMP-OTH-002, R-DED-001 | krever_avklaring |
| PB-PHEV | personbil | ladbar hybrid | relevant | a | R-OTA-001, R-OTA-002, R-OTA-005, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001, R-IMP-OTH-001, R-IMP-OTH-002, R-DED-001 | krever_avklaring |
| PB-BEV | personbil | batterielektrisk | relevant | a | R-OTA-001, R-OTA-007, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-VAT-003, R-IMP-FX-001, R-IMP-OTH-001, R-DED-001 | krever_avklaring |
| VB-BEN | varebil | bensin | relevant | a (klasse 1) eller b (klasse 2) | R-OTA-001, R-OTA-002, R-OTA-008, R-OTA-009, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001, R-IMP-OTH-001, R-IMP-OTH-002, R-DED-001 | krever_avklaring |
| VB-DIE | varebil | diesel | relevant | a eller b | R-OTA-001, R-OTA-002, R-OTA-003, R-OTA-008, R-OTA-009, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001, R-IMP-OTH-001, R-IMP-OTH-002, R-DED-001 | krever_avklaring |
| VB-HEV | varebil | ikke-ladbar hybrid | krever_avklaring_av_relevans | a eller b | R-OTA-001, R-OTA-002, R-OTA-006, R-OTA-008, R-OTA-009, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001 | krever_avklaring |
| VB-PHEV | varebil | ladbar hybrid | krever_avklaring_av_relevans | a eller b | R-OTA-001, R-OTA-002, R-OTA-005, R-OTA-008, R-OTA-009, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-FX-001 | krever_avklaring |
| VB-BEV | varebil | batterielektrisk | relevant | a eller b | R-OTA-001, R-OTA-007, R-OTA-008, R-OTA-009, R-OTA-010, R-OTA-011, R-IMP-VAT-001, R-IMP-VAT-002, R-IMP-VAT-003, R-IMP-FX-001, R-DED-001 | krever_avklaring |

Detaljer per profil (nødvendig input, hva kilden har/mangler, demo-bekreftelser og blokkeringer) står i `profiles.json`.

## 3. Hva dagens modeller har og mangler (felles)
- `NormalizedListing` har: førstegangsregistrering (år/måned/dato), kilometerstand, drivstoff (`petrol/diesel/electric/hybrid/plugin_hybrid/other`), karosseri, `powerKw`, `co2 {gramsPerKm, testMethod}` (kan være `null`), `curbWeightKg` (vekttype uklar), annonsepris med brutto/netto/ukjent og mva.-påstander, selger.
- `CandidateV2` har: `firstRegistration`, `mileageKm`, `fuel`, `bodyType`, id/versjon. Den har **ikke** CO2, vekt, elektrisk rekkevidde, kjøretøyklasse, avgiftsgruppe, ombygging/godkjenning, klimaanleggets gass, planlagt registreringsdato eller kjøpsbekreftelse.
- Fuel «hybrid» skiller ikke ladbar fra ikke-ladbar eller mild/full.
- **Ingen kandidatadapter skal omskrives for å gi falsk datadekning.** Manglende felt gir blokkering, ikke gjetting.

## 4. Registreringsdato og presisjon
Bruksfradrag og regelversjon avhenger av dato. Hvis år eller måned ikke avgjør et tabelltrinn eller en regelgrense (inkl. 1.9.2026), kreves tilstrekkelig presisjon (dag) eller så blokkeres beregningen (`C3-021`, `C3-022`).

## 5. Forslag: separate, versjonerte inndata (`TaxInputV1`, forslag)
Endrer ingen eksisterende typer. Kobles til kandidat og kostnadsgrunnlag som i SEARCH-002-FIX1.

```jsonc
{
  "contract": "merovo.tax-input", "contractVersion": 1,
  "ruleSet": { "id": "…", "version": "…", "researchEvidence": "E1-only" },   // regelversjon må velges per registreringsdato
  "binding": {
    "candidateId": "<CandidateV2.id>", "candidateVersion": "<CandidateV2.version>",
    "costBasis": "<costBasisOf(spec)>"                                       // SEARCH-002-FIX1
  },
  "plannedRegistration": { "scenario": "passenger|van|unspecified", "date": "YYYY-MM-DD" },   // dato kreves
  "vehicle": {
    "powertrain": "petrol|diesel|bev|hev|phev", "documentedClass": { "value": "M1|N1|…", "evidence": "ref" },
    "taxGroup": { "value": "a|b|…", "determinedBy": "Statens vegvesen|Skatteetaten", "evidence": "ref" },
    "kerbWeightKg": { "value": 0, "definition": "norsk egenvekt", "evidence": "ref" },
    "co2": { "gramsPerKm": 0, "testMethod": "WLTP|NEDC", "weightedCombined": false },
    "electricRangeKm": null, "acRefrigerant": { "type": null, "grams": null },
    "firstRegistrationAbroad": { "precision": "year|month|date", "value": "…" },
    "conversion": { "cost": null, "approvalEvidence": null }
  },
  "purchase": {
    "price": { "amountMinor": "…", "currency": "EUR" },
    "basis": "gross|net|unknown", "regime": "ordinary|margin|private|unknown",
    "confirmation": { "kind": "document|synthetic_demo", "ref": "…" },      // synthetic_demo må vises som syntetisk
    "paidGross": null, "refundExpected": null
  },
  "fx": { "customs": { "rate": "…", "source": "Tolletaten", "validFrom": "…" }, "payment": { "rate": "…", "buffer": null } },
  "transport": { "toBorder": { "amountMinor": null, "currency": null }, "afterBorder": { "amountMinor": null }, "insuranceToBorder": { "amountMinor": null } },
  "importer": { "vatRegistered": null, "deductionProfile": null },
  "validity": { "validUntil": "UTC", "staleOn": ["candidateVersion","costBasis","ruleSet","plannedRegistration.date","fx","purchase.confirmation","vehicle.*"] }
}
```
Alle `null` betyr *ukjent*, aldri 0. Eksplisitt 0 er et valg.

**Foreldelse – ny vurdering kreves når:** kandidatrevisjon, kostnadsgrunnlag, regelsett/-versjon, planlagt registreringsdato (inkl. kryssing av regelendringsdato), kursgrunnlag, kjøpsbekreftelse/regime eller noe kjøretøyfelt endres, eller `validUntil` er passert.
