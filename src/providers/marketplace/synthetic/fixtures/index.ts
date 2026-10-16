import type { SyntheticRawListing } from "../raw";
import { generatedRawListings } from "./generated";
import { demoVariationRawListings } from "./demo-variation";
import { handwrittenRawListings } from "./handwritten";

/** Standard syntetisk datasett: 9 håndskrevne + 100 genererte annonser (pluss revisjoner/duplikat) + 6 håndskrevne variasjonsposter (DEV-006C). */
export const syntheticRawListings: readonly SyntheticRawListing[] = [...handwrittenRawListings, ...generatedRawListings, ...demoVariationRawListings];
