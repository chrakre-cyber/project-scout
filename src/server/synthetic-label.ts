import "server-only";
import { syntheticDatasetLabel } from "@/providers/marketplace";

/** «Syntetisk generert <dato> — ikke hentet fra leverandør» for UI-skallet; null når datasettepoken er ugyldig (da feiler kilden lukket). */
export function syntheticGeneratedLabel(): string | null {
  return syntheticDatasetLabel();
}
