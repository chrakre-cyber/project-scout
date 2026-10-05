import type { SyntheticRawListing } from "../raw";
import { generatedRawListings } from "./generated";
import { handwrittenRawListings } from "./handwritten";

/** Standard syntetisk datasett: 9 håndskrevne + 100 genererte annonser (pluss revisjoner/duplikat). */
export const syntheticRawListings: readonly SyntheticRawListing[] = [...handwrittenRawListings, ...generatedRawListings];
