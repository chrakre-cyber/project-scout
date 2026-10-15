/*
 * Feltkatalog for forhåndsvisningen SEARCH-001A-UI. Rene data, ingen DOM og ingen nettverk.
 * Kataloger for merke/modell/land/sertifisering er DEMONSTRASJONSUTVALG, ikke en fullstendig europeisk katalog.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MerovoData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const opt = (v, l) => ({ v, l });

  const BRANDS = [
    opt("audi", "Audi"), opt("bmw", "BMW"), opt("land-rover", "Land Rover"), opt("mercedes-benz", "Mercedes-Benz"),
    opt("porsche", "Porsche"), opt("volkswagen", "Volkswagen"), opt("volvo", "Volvo"),
  ];

  // Modeller, varianter og pakker per merke. Demonstrasjonsutvalg; variant og pakke er modellavhengige.
  const MODELS = {
    audi: [
      { v: "a4", l: "A4", variants: ["A4 Avant 40 TDI", "A4 Avant 45 TFSI"], packages: ["S line"] },
      { v: "a6", l: "A6", variants: ["A6 Avant 40 TDI", "A6 Avant 55 TFSI e"], packages: ["S line"] },
      { v: "q5", l: "Q5", variants: ["Q5 40 TDI quattro", "Q5 50 TFSI e"], packages: ["S line"] },
      { v: "q7", l: "Q7", variants: ["Q7 50 TDI quattro", "Q7 55 TFSI e"], packages: ["S line"] },
    ],
    bmw: [
      { v: "3-serie", l: "3-serie", variants: ["320d xDrive", "330e"], packages: ["M Sport"] },
      { v: "5-serie", l: "5-serie", variants: ["520d xDrive", "530e"], packages: ["M Sport"] },
      { v: "x3", l: "X3", variants: ["xDrive20d", "xDrive30e"], packages: ["M Sport"] },
      { v: "x5", l: "X5", variants: ["xDrive30d", "xDrive45e"], packages: ["M Sport"] },
    ],
    "land-rover": [
      { v: "defender", l: "Defender", variants: ["Defender 110 D250"], packages: [] },
      { v: "discovery", l: "Discovery", variants: ["Discovery D250"], packages: [] },
      { v: "range-rover", l: "Range Rover", variants: ["Range Rover D350", "Range Rover P440e"], packages: ["Autobiography"] },
    ],
    "mercedes-benz": [
      { v: "c-klasse", l: "C-klasse", variants: ["C 220 d", "C 300 e"], packages: ["AMG Line"] },
      { v: "e-klasse", l: "E-klasse", variants: ["E 220 d", "E 300 e"], packages: ["AMG Line"] },
      { v: "gle", l: "GLE", variants: ["GLE 350 de 4MATIC", "GLE 450 4MATIC"], packages: ["AMG Line", "Night-pakke"] },
      { v: "gls", l: "GLS", variants: ["GLS 400 d 4MATIC", "GLS 450 4MATIC", "GLS 580 4MATIC"], packages: ["AMG Line", "Night-pakke", "Premium Plus-pakke"] },
      { v: "s-klasse", l: "S-klasse", variants: ["S 400 d 4MATIC", "S 580 e"], packages: ["AMG Line"] },
    ],
    porsche: [
      { v: "cayenne", l: "Cayenne", variants: ["Cayenne E-Hybrid"], packages: [] },
      { v: "macan", l: "Macan", variants: ["Macan 4", "Macan S"], packages: [] },
    ],
    volkswagen: [
      { v: "golf", l: "Golf", variants: ["Golf 1.5 eTSI", "Golf GTI"], packages: ["R-Line"] },
      { v: "passat", l: "Passat", variants: ["Passat 2.0 TDI"], packages: ["R-Line"] },
      { v: "tiguan", l: "Tiguan", variants: ["Tiguan 2.0 TDI 4Motion"], packages: ["R-Line"] },
      { v: "touareg", l: "Touareg", variants: ["Touareg 3.0 TDI"], packages: ["R-Line"] },
    ],
    volvo: [
      { v: "xc60", l: "XC60", variants: ["XC60 B5 AWD", "XC60 T6 Recharge"], packages: ["R-Design", "Inscription"] },
      { v: "xc90", l: "XC90", variants: ["XC90 B5 AWD", "XC90 T8 Recharge"], packages: ["R-Design", "Inscription"] },
    ],
  };

  const COUNTRIES = [
    opt("AT", "Østerrike"), opt("BE", "Belgia"), opt("CH", "Sveits"), opt("DE", "Tyskland"), opt("DK", "Danmark"),
    opt("ES", "Spania"), opt("FR", "Frankrike"), opt("IT", "Italia"), opt("NL", "Nederland"), opt("PL", "Polen"), opt("SE", "Sverige"),
  ];

  const CERTIFICATIONS = [
    opt("audi-plus", "Audi Gebrauchtwagen :plus"), opt("bmw-ps", "BMW Premium Selection"),
    opt("mb-certified", "Mercedes-Benz Certified"), opt("das-weltauto", "Das WeltAuto"),
  ];

  const CURRENCIES = ["NOK", "EUR", "SEK", "DKK", "CHF", "GBP", "PLN"]; // DEC-018

  const EXT_COLORS = [
    { v: "black", l: "Svart", c: "#1c1c1c" }, { v: "white", l: "Hvit", c: "#f5f5f5" }, { v: "grey", l: "Grå", c: "#8a8d90" },
    { v: "silver", l: "Sølv", c: "#c0c3c7" }, { v: "blue", l: "Blå", c: "#2f5fb3" }, { v: "red", l: "Rød", c: "#c0392b" },
    { v: "green", l: "Grønn", c: "#3a7d44" }, { v: "brown", l: "Brun", c: "#7a5230" }, { v: "beige", l: "Beige", c: "#d9c7a0" },
    { v: "yellow", l: "Gul", c: "#e6c229" }, { v: "orange", l: "Oransje", c: "#e67e22" }, { v: "other", l: "Annen farge", c: "" },
  ];
  const INT_COLORS = [
    { v: "beige", l: "Beige", c: "#d9c7a0" }, { v: "black", l: "Svart", c: "#1c1c1c" }, { v: "blue", l: "Blå", c: "#2f5fb3" },
    { v: "brown", l: "Brun", c: "#7a5230" }, { v: "grey", l: "Grå", c: "#8a8d90" }, { v: "red", l: "Rød", c: "#c0392b" }, { v: "other", l: "Annen farge", c: "" },
  ];

  /** Utstyrskatalog. Hver nøkkel er stabil; «visible» er sentrale valg som vises direkte, resten ligger bak «Vis flere». */
  const EQUIPMENT_GROUPS = [
    {
      id: "parking", section: "exterior", title: "Parkering og kamera",
      items: [
        ["park_front", "Parkeringssensor foran"], ["park_rear", "Parkeringssensor bak"], ["rear_camera", "Ryggekamera"],
        ["camera_360", "360-kamera"], ["auto_park", "Automatisk parkering"], ["exit_assist", "Utkjøringsassistent"],
      ],
      visible: 6,
    },
    {
      id: "driving", section: "exterior", title: "Kjøreutstyr og eksteriør", searchable: true,
      items: [
        ["air_suspension", "Luftfjæring"], ["adaptive_chassis", "Adaptivt understell"], ["panoramic_roof", "Panoramatak"],
        ["sunroof", "Soltak / skyvetak"], ["power_tailgate", "Elektrisk bakluke"], ["led_headlights", "LED-hovedlys"],
        ["laser_light", "Laserlys"], ["high_beam_assist", "Fjernlysassistent"], ["blind_spot", "Blindsonevarsling"],
        ["lane_keep", "Filholder"], ["traffic_sign", "Trafikkskiltgjenkjenning"], ["winter_package", "Vinterpakke"],
        ["xenon", "Xenonlys"], ["heated_windscreen", "Oppvarmet frontrute"], ["extra_wheels", "Ekstra hjulsett"],
        ["emergency_brake", "Nødbremsassistent"], ["adaptive_cornering", "Adaptivt kurvelys"], ["sport_suspension", "Sportsfjæring"],
        ["night_vision", "Nattsynsassistent"], ["tyre_pressure", "Dekktrykkovervåking"], ["headlight_washers", "Lykterengjøring"],
        ["roof_rails", "Takrails"],
      ],
      visible: 12,
    },
    {
      id: "seats", section: "interior", title: "Seteutstyr",
      items: [
        ["power_seats", "Elektriske seter"], ["seat_memory", "Setehukommelse"], ["heated_seats_front", "Setevarme foran"],
        ["heated_seats_rear", "Setevarme bak"], ["ventilated_seats", "Ventilerte seter"], ["massage_seats", "Massasjeseter"], ["sport_seats", "Sportsseter"],
      ],
      visible: 7,
    },
    {
      id: "interior_other", section: "interior", title: "Annet interiørutstyr", searchable: true,
      items: [
        ["heated_steering", "Rattvarme"], ["head_up", "Head-up-display"], ["carplay", "Apple CarPlay"], ["android_auto", "Android Auto"],
        ["dab", "DAB-radio"], ["navigation", "Navigasjon"], ["premium_audio", "Premium lydanlegg"], ["wireless_charging", "Trådløs lading"],
        ["isofix", "Isofix"], ["parking_heater", "Parkeringsvarmer"], ["keyless", "Nøkkelfri adgang"], ["digital_cockpit", "Digitalt instrumentpanel"],
      ],
      visible: 8,
    },
  ];

  const PRIORITY = [opt("must", "Må ha"), opt("nice", "Ønskelig")];

  /** Seksjoner og felt. kind: select | radio | multi | colors | range | max | regrange | month | text | text2 | power | weight | consumption | towbar | brand | model | variant | packages | equipSelect */
  const SECTIONS = [
    {
      id: "vehicle", n: 1, title: "Bil og basisdata",
      fields: [
        { id: "brand", kind: "brand", label: "Merke", demo: true },
        { id: "model", kind: "model", label: "Modell", demo: true },
        { id: "variant", kind: "variant", label: "Variant", help: "Fritekst. Variant og utstyrspakke er separate kriterier; forslagene er demonstrasjonsutvalg." },
        { id: "packages", kind: "packages", label: "Utstyrspakke (modellavhengig)", demo: true },
        { id: "modelYear", kind: "range", label: "Modellår", unit: "år", plain: true, min: 1950, max: 2100, fromLabel: "Fra modellår", toLabel: "Til modellår", help: "Modellår er en egen opplysning og er ikke det samme som registreringsår." },
        { id: "firstReg", kind: "regrange", label: "Førstegangsregistrering", help: "Skriv ÅÅÅÅ eller ÅÅÅÅ-MM. Kildens presisjon beholdes; ingen dag eller måned dikter opp." },
        { id: "mileage", kind: "max", label: "Kilometerstand (maks)", unit: "km", min: 1, max: 2000000 },
        { id: "body", kind: "multi", label: "Karosseri", options: [
          opt("sedan", "Sedan"), opt("estate", "Stasjonsvogn"), opt("suv", "SUV / terrengbil"), opt("hatchback", "Kombi (hatchback)"),
          opt("coupe", "Coupé"), opt("convertible", "Cabriolet"), opt("van", "Van / minibuss"), opt("other", "Annet"),
        ], help: "Flere valg betyr ELLER." },
        { id: "seats", kind: "range", label: "Antall seter", unit: "seter", min: 1, max: 20, fromLabel: "Seter fra", toLabel: "Seter til", help: "Eksakt antall: samme verdi i begge felter." },
        { id: "doors", kind: "select", label: "Antall dører", options: [opt("2-3", "2/3 dører"), opt("4-5", "4/5 dører"), opt("6-7", "6/7 dører")] },
      ],
    },
    {
      id: "engine", n: 2, title: "Motor og tekniske data",
      fields: [
        { id: "fuel", kind: "multi", label: "Drivstoff / drivlinje", options: [opt("petrol", "Bensin"), opt("diesel", "Diesel"), opt("electric", "Elektrisk"), opt("hybrid", "Hybrid"), opt("plugin_hybrid", "Ladbar hybrid")], help: "Flere valg betyr ELLER." },
        { id: "gear", kind: "multi", label: "Girkasse", options: [opt("automatic", "Automat"), opt("manual", "Manuell")] },
        { id: "drive", kind: "multi", label: "Hjuldrift", options: [opt("awd", "Firehjulsdrift"), opt("fwd", "Forhjulsdrift"), opt("rwd", "Bakhjulsdrift")] },
        { id: "power", kind: "power", label: "Effekt" },
      ],
      advanced: {
        title: "Flere tekniske valg",
        fields: [
          { id: "displacement", kind: "range", label: "Slagvolum", unit: "cm³", min: 50, max: 10000, fromLabel: "Slagvolum fra", toLabel: "Slagvolum til" },
          { id: "cylinders", kind: "range", label: "Sylindre", unit: "sylindre", min: 1, max: 16, fromLabel: "Sylindre fra", toLabel: "Sylindre til" },
          { id: "weight", kind: "weight", label: "Vekt (maks)", help: "Velg hvilken vekttype det gjelder. Egenvekt og tillatt totalvekt blandes ikke." },
          { id: "consumption", kind: "consumption", label: "Forbruk (maks)", help: "Liter/100 km og kWh/100 km er ulike enheter og blandes ikke. Testmetode (WLTP/NEDC) hentes fra annonsen der den finnes." },
          { id: "euro", kind: "multi", label: "Utslippsklasse", options: [opt("euro4", "Euro 4"), opt("euro5", "Euro 5"), opt("euro6", "Euro 6")], help: "Separat fra CO₂. Ingen avgift beregnes fra utslippsklasse." },
          { id: "sliding", kind: "radio", label: "Skyvedør", options: [opt("", "Alle"), opt("right", "Skyvedør høyre"), opt("left", "Skyvedør venstre"), opt("both", "Skyvedør begge sider")] },
        ],
      },
    },
    {
      id: "exterior", n: 3, title: "Eksteriør og kjøreutstyr",
      fields: [
        { id: "extColor", kind: "colors", label: "Utvendig farge", options: EXT_COLORS, help: "Flere farger er alternativer (ELLER)." },
        { id: "extFinish", kind: "multi", label: "Lakktype", options: [opt("metallic", "Metallic"), opt("matt", "Matt")], help: "Metallic og matt er separate fra selve fargen." },
        { id: "towbar", kind: "towbar", label: "Hengerfeste", options: [
          opt("any", "Hvilket som helst hengerfeste"), opt("fixed_removable_swivel", "Fast, avtakbart eller svingbart"),
          opt("removable_swivel", "Avtakbart eller svingbart"), opt("swivel_only", "Bare svingbart"),
        ], help: "Prototypens tolkning, som må avklares i SEARCH-001B: «Hvilket som helst» krever hengerfeste uansett type, også når typen ikke er oppgitt. De andre valgene krever at typen er oppgitt i annonsen." },
        { id: "trailerBraked", kind: "max", label: "Tilhengervekt med brems (minst)", unit: "kg", min: 1, max: 10000, minimum: true },
        { id: "trailerUnbraked", kind: "max", label: "Tilhengervekt uten brems (minst)", unit: "kg", min: 1, max: 10000, minimum: true },
        { id: "noseWeight", kind: "max", label: "Kuletrykk (minst)", unit: "kg", min: 1, max: 500, minimum: true },
        { id: "cruise", kind: "equipSelect", label: "Cruisekontroll", options: [opt("any", "Cruisekontroll (vanlig eller adaptiv)"), opt("adaptive", "Bare adaptiv cruisekontroll")], help: "Regel i prototypen: adaptiv cruisekontroll oppfyller et generelt cruisekrav." },
      ],
      equipment: ["parking", "driving"],
    },
    {
      id: "interior", n: 4, title: "Interiør og komfort",
      fields: [
        { id: "intColor", kind: "colors", label: "Interiørfarge", options: INT_COLORS, help: "Flere farger er alternativer (ELLER)." },
        { id: "material", kind: "multi", label: "Interiørmateriale", options: [
          opt("leather", "Skinn"), opt("part_leather", "Delskinn"), opt("faux_leather", "Kunstskinn"), opt("fabric", "Stoff"),
          opt("alcantara", "Alcantara"), opt("velour", "Velur"), opt("other", "Annet"),
        ] },
        { id: "climate", kind: "equipSelect", label: "Klima", options: [
          opt("ac", "Klimaanlegg"), opt("auto", "Automatisk klima"), opt("min2", "Minst 2 soner"), opt("min3", "Minst 3 soner"),
          opt("exact2", "Nøyaktig 2 soner"), opt("exact3", "Nøyaktig 3 soner"), opt("exact4", "Nøyaktig 4 soner"),
        ], help: "Minst 2 soner kan oppfylles av 3 eller 4. Eksakt antall er et eget valg." },
      ],
      equipment: ["seats", "interior_other"],
    },
    {
      id: "condition", n: 5, title: "Tilstand, selger og kjøpsvilkår",
      fields: [
        { id: "newUsed", kind: "radio", label: "Ny / brukt", options: [opt("", "Alle"), opt("new", "Ny"), opt("used", "Brukt")] },
        { id: "damage", kind: "radio", label: "Skadestatus (oppgitt i annonsen)", options: [opt("", "Alle"), opt("exclude", "Ekskluder oppgitt skadede"), opt("only", "Bare oppgitt skadede")],
          help: "Ukjent skadestatus regnes ikke som «skadefri»; bilen vises da som «må kontrolleres»." },
        { id: "service", kind: "multi", label: "Service (oppgitt i annonsen)", options: [opt("history", "Servicehistorikk oppgitt"), opt("recent", "Ny service oppgitt")] },
        { id: "warranty", kind: "multi", label: "Garanti (oppgitt i annonsen)", options: [opt("warranty", "Garanti oppgitt")] },
        { id: "certification", kind: "select", label: "Bruktbilprogram / sertifisering", options: CERTIFICATIONS, demo: true, help: "Demonstrasjonsutvalg. Garanti og sertifisering er separate kriterier." },
        { id: "owners", kind: "max", label: "Tidligere eiere (maks)", unit: "eiere", min: 0, max: 20 },
        { id: "prevUse", kind: "multi", label: "Tidligere bruk (oppgitt i annonsen)", options: [opt("demo", "Demobil"), opt("taxi", "Drosje"), opt("rental", "Utleiebil")], help: "Registreringstype er ikke nødvendigvis tidligere bruk." },
        { id: "inspection", kind: "month", label: "Kontroll gyldig til (minst)", help: "Skriv ÅÅÅÅ-MM. Tysk HU/TÜV er ikke norsk EU-kontroll." },
        { id: "seller", kind: "multi", label: "Selgertype", options: [opt("dealer", "Forhandler"), opt("private", "Privat"), opt("company", "Firma")], help: "Der kilden skiller disse." },
        { id: "country", kind: "multi", label: "Land (selgers)", options: COUNTRIES, demo: true, help: "Demonstrasjonsutvalg av land." },
        { id: "vat", kind: "radio", label: "Mva. oppgitt i annonsen", options: [opt("", "Alle"), opt("specifiable", "Mva. oppgitt som spesifiserbar"), opt("not_specifiable", "Mva. oppgitt som ikke spesifiserbar")],
          help: "Dette er hva annonsen oppgir. Det bekrefter ikke at bilen kan kjøpes netto eller importeres uten lokal mva. Ukjent mva.-status beholdes som ukjent." },
        { id: "adAge", kind: "select", label: "Annonsens alder", options: [opt("1", "Siste dag"), opt("3", "Siste 3 dager"), opt("7", "Siste 7 dager"), opt("14", "Siste 14 dager")], help: "Forutsetter at kilden oppgir publiseringstid." },
        { id: "freeText", kind: "text", label: "Søk i annonsetekst (supplerende)", max: 200, help: "Bekrefter ikke strukturerte krav automatisk." },
      ],
    },
  ];

  const FIXED_COSTS = [
    { key: "transport", label: "Transport" }, { key: "travel", label: "Reise / henting" },
    { key: "insurance", label: "Forsikring" }, { key: "prep", label: "Klargjøring" },
  ];
  const VAT_BASIS = [opt("", "Ikke oppgitt"), opt("incl", "Inkl. mva."), opt("excl", "Ekskl. mva."), opt("none", "Ingen mva.")];

  const SCHEMA = "merovo.search-draft";
  const SCHEMA_VERSION = 2; // v2: valuta per kostnadslinje også uten beløp, kanonisk effekt i watt. v1 migreres eksplisitt ved import.
  const SUPPORTED_VERSIONS = [1, 2];
  const LIMITS = { importBytes: 200000, maxCosts: 30, labelMax: 60, maxBudgetMinor: 100000000000n, maxCostMinor: 100000000000n };

  return { opt, BRANDS, MODELS, COUNTRIES, CERTIFICATIONS, CURRENCIES, EXT_COLORS, INT_COLORS, EQUIPMENT_GROUPS, PRIORITY, SECTIONS, FIXED_COSTS, VAT_BASIS, SCHEMA, SCHEMA_VERSION, SUPPORTED_VERSIONS, LIMITS };
});
