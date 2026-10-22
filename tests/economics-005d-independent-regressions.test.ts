import { expect, it } from 'vitest';
import { previewForDisplay } from '@/server/search-display';
import { storedKey } from '@/server/dealer-economics';
import { rightsForSource } from '@/domain/provider-rights';
import type { MarketplaceProvider } from '@/providers/marketplace';
import { profile } from './fixtures/rights-profiles';
import { FIRM_A, NOW, SEARCH_1, listing, specOf, candidateFor, stored } from './fixtures/economics-005c';

it('denied economics display hides early refusal details and dealer confirmation state', async () => {
  const p = profile({ storage: { ...profile().storage, retentionSeconds: 604800 }, derivedEconomics: { allow: { price: true, registration: true, specs: true }, display: false } });
  const l = listing({ lastSeenAt: '2026-10-21T10:00:00Z' });
  const spec = specOf();
  const cand = candidateFor(l);
  const rights = rightsForSource('synthetic-demo', NOW, [p]);
  const provider: MarketplaceProvider = { source: 'synthetic-demo', search: async () => ({items:[l], nextPage:null, sourceTotal:1, truncated:false, fetchedAt:NOW.toISOString(), rejected:[]}), getListing: async () => l };
  const out = await previewForDisplay(spec, { provider, profiles:[p], now:()=>NOW, economics: { dealershipId:FIRM_A, searchId:SEARCH_1, storedInputs:new Map([[storedKey(cand.id,cand.version), stored({rights,spec,cand})]]), profile:null } });
  expect(out.ok).toBe(true);
  if (!out.ok) throw new Error('unexpected source failure');
  expect(out.items).toHaveLength(1);
  expect(out.items[0]!.economics).toEqual({status:'unavailable',labelKey:'rights_not_granted',positiveBudgetEligible:false});
});
