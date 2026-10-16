/**
 * Lesetilgang til syntetiske demo-agenter. Annonser hentes via
 * MarketplaceProvider (src/providers/marketplace), ikke herfra.
 * DEV-004 erstatter dette med lagrede agenter.
 */
import { demoAgents, type DemoAgent } from "./fixtures";

export function listDemoAgents(): DemoAgent[] {
  return [...demoAgents];
}

export function getDemoAgent(agentId: string): DemoAgent | null {
  return demoAgents.find((a) => a.id === agentId) ?? null;
}

export function agentsForListing(sourceListingId: string): DemoAgent[] {
  return demoAgents.filter((a) => a.demoListingIds.includes(sourceListingId));
}
