# CI-001 — underlagsreview av kjøring 39603111353

## Konklusjon
Rapporten CI-001-kjoring-3.md gir et konsistent grunnlag for en avgrenset testretting: filtrer de to PATCH-kallene på det innloggede firmaets egen profil, slik appen allerede gjør. Behold eksisterende forventninger og tilgangsregler. Ingen nye blokkerende funn i dokumentreviewen.

For eget-firma-testen er mål firmA. For forsøket på å flytte Bs profil til A er filteret firmB, mens payload fortsatt forsøker å sette dealership_id til firmA. Filtrering på A i dette siste tilfellet ville skjult Bs rad før operasjonen og ikke testet den tilsiktede kolonnerettigheten.

## Bevis og avgrensning
Rapporten viser at begge profilene ble opprettet før test 1 stoppet på PATCH. Test 2 kom gjennom sine foregående påstander og stoppet på sitt eget ufiltrerte PATCH-kall. Det støtter vurderingen av to selvstendige avvik, fremfor en oppsettsfølgefeil.

HTTP 400 / 21000 er ikke den forventede 403 / 42501-avvisningen. Det bekrefter ikke i seg selv hvilken komponent som avviser, eller at safeupdate er aktiv. Rapportens formulering «ikke RLS-avvisning» bør leses snevert: det observerte svaret prøver ikke den forventede grant-/RLS-påstanden. Ikke før videre en sikker påstand om intern evalueringsrekkefølge ut fra statuskoden alene.

Det er ikke nødvendig å identifisere utvidelsen for å prøve den eksplisitt filtrerte forespørselen som appen bruker. Behold forventet 200 og oppdatert rad i positiv test, og 403/42501 med uendrede profiler i flyttetesten. Ikke utvid de aksepterte svarene med 400/21000.

## Egne kontroller
Den vedlagte rapporten er lest og sammenholdt med tidligere reviewet testkode og diagnostikk. Ingen ny database-, nettleser- eller Actions-kjøring er utført. Originalloggen er ikke hentet eller uavhengig bekreftet; dette er review av levert rapport. Kjent J3-delvis dekning er fortsatt åpen.

Testrettingen skal leveres til re-review før en ny separat autorisert kjøring. Ingen RLS-/grantendring, migrasjon, main-endring eller deploy inngår i anbefalingen. CI-001 forblir REVIEW, L3c utsatt og økonomiflaggene uendret.
