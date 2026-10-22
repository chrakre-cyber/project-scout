import type { SyntheticRawListing } from "../raw";
import { generatedRawListings } from "./generated";
import { demoIx3RawListings } from "./demo-ix3";
import { demoVariationRawListings } from "./demo-variation";
import { handwrittenRawListings } from "./handwritten";

/** Standard syntetisk datasett: 9 håndskrevne + 100 genererte annonser (pluss revisjoner/duplikat) + 6 håndskrevne variasjonsposter (DEV-006C) + 10 kuraterte iX3-poster (DEMO-RESULTS-001). */
export const syntheticRawListings: readonly SyntheticRawListing[] = [...handwrittenRawListings, ...generatedRawListings, ...demoVariationRawListings, ...demoIx3RawListings];
