import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { adaptPrototypeDraft } from '@/adapters/search-prototype/adapt';
import { TEST_CATALOG } from './fixtures/search-v2';
const req = createRequire(import.meta.url);
const L = req('../prototypes/merovo-search/js/logic.js');
const extra = {plannedRegistration:'unspecified'};
function draft() { return L.exportDraft(L.emptyState(),new Date('2026-10-15T12:00:00Z')).draft; }
describe('Codex independent malformed input regressions',()=>{
 it('unknown brand must still be invalid when unsupported country is present',()=>{
  const d=draft(); d.criteria.brand='invented-brand'; d.criteria.country=['DE'];
  const r=adaptPrototypeDraft(d,TEST_CATALOG,extra);
  expect(r.ok).toBe(false); if(!r.ok) expect(r.kind).toBe('invalid');
 });
 it('reversed unsupported displacement range must be invalid',()=>{
  const d=draft(); d.criteria.displacement={from:4000,to:1000,unit:'cm³'};
  const r=adaptPrototypeDraft(d,TEST_CATALOG,extra);
  expect(r.ok).toBe(false); if(!r.ok) expect(r.kind).toBe('invalid');
 });
 it('out of range consumption must be invalid',()=>{
  const d=draft(); d.criteria.consumption={unit:'l100',max:'999.9',perUnit:'100 km'};
  const r=adaptPrototypeDraft(d,TEST_CATALOG,extra);
  expect(r.ok).toBe(false); if(!r.ok) expect(r.kind).toBe('invalid');
 });
 it('unknown radio option must be invalid',()=>{
  const d=draft(); d.criteria.vat='invented-option';
  const r=adaptPrototypeDraft(d,TEST_CATALOG,extra);
  expect(r.ok).toBe(false); if(!r.ok) expect(r.kind).toBe('invalid');
 });
});
