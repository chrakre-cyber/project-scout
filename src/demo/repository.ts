/**
 * Lesetilgang til syntetiske demodata for UI-et.
 *
 * Skjermene henter data herfra og kjenner ikke til fixture-filen direkte, slik
 * at DEV-003 (MarketplaceProvider) og DEV-002/DEV-004 (database) kan bytte ut
 * implementasjonen uten å endre komponentene.
 */
import type { NormalizedListing } from "@/domain/types";
import { demoAgents, demoListings, type DemoAgent } from "./fixtures";

export function listDemoListings(agentId?: string): NormalizedListing[] {
  const sorted = [...demoListings].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
  if (!agentId) return sorted;
  const agent = getDemoAgent(agentId);
  if (!agent) return [];
  return sorted.filter((l) => agent.demoListingIds.includes(l.sourceListingId));
}

export function getDemoListing(sourceListingId: string): NormalizedListing | null {
  return demoListings.find((l) => l.sourceListingId === sourceListingId) ?? null;
}

export function listDemoAgents(): DemoAgent[] {
  return [...demoAgents];
}

export function getDemoAgent(agentId: string): DemoAgent | null {
  return demoAgents.find((a) => a.id === agentId) ?? null;
}

export function agentsForListing(sourceListingId: string): DemoAgent[] {
  return demoAgents.filter((a) => a.demoListingIds.includes(sourceListingId));
}
