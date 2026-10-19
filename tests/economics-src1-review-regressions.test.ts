import { describe, expect, it } from 'vitest';
import { calculateEconomics, type EconomicsInput, type EconomicsConfig } from '@/domain/economics';
import { ECON_CASES } from './fixtures/econ-golden';

const na = { state: 'not_applicable', basis: 'explicit test' } as const;
const cfg: EconomicsConfig = {
  rounding: { mode: 'half_up', status: 'approved' },
  profile: { vatRulesApproved: true, roundingApproved: true, customsFxRuleApproved: true, deductionRuleApproved: true },
};
function base(): EconomicsInput {
  const taxInput = structuredClone(ECON_CASES[2]!.golden.input);
  taxInput.norwegianTaxWeight.basis = 'vehicle_register';
  taxInput.propulsion.evidence = 'type_approval';
  return {
    price: { currency: 'NOK', advertisedNet: '100000', priceBasis: 'net', use: 'advertised', evidence: 'quote_document' },
    fx: {}, taxInput, transportToBorder: { amount: '0', basis: 'quoted' }, transportAfterBorder: na, loadingHandling: na,
    insurance: { amount: '0', basis: 'quoted' }, deduction: { value: 'non_recoverable', source: { kind: 'dealer_profile' } },
    vatHandling: { value: 'registered_reports_in_vat_return', source: { kind: 'dealer_profile' } },
    charges: { climateGas: na, registrationFee: na, customsDuty: na }, asOf: '2026-10-19',
  };
}
describe('Codex SRC1 review regressions', () => {
  it('NOK: unknown acceptance date is incomplete even without currency conversion', () => {
    const r = calculateEconomics(base(), cfg);
    expect(r.status).toBe('incomplete');
    expect(r.incompleteReasons).toContain('customs_acceptance_date_unknown');
  });
  it('NOK: expected acceptance date remains an estimate', () => {
    const r = calculateEconomics({ ...base(), customsDate: { date: '2026-10-25', kind: 'expected_scenario' } }, cfg);
    expect(r.status).toBe('estimate');
    expect(r.estimateReasons).toContain('customs_acceptance_date_expected');
  });
  it('fallback quote does not bypass missing acceptance date', () => {
    const i = base();
    const r = calculateEconomics({ ...i, price: { ...i.price, currency: 'EUR', advertisedNet: '10000' },
      fx: { acquisition: { pair: 'EUR/NOK', rate: '10', source: { kind: 'bank' }, effectiveAt: '2026-10-18', quotedAt: '2026-10-18' },
        customsFallback: 'use_acquisition_rate_assumed' } }, cfg);
    expect(r.status).toBe('incomplete');
    expect(r.incompleteReasons).toContain('customs_acceptance_date_unknown');
  });
  it('unknown handling does not emit a channel contradicting accepted recoverable status', () => {
    const r = calculateEconomics({ ...base(), customsDate: { date: '2026-10-18', kind: 'actual_acceptance' },
      vatHandling: null, deduction: { value: 'recoverable', source: { kind: 'dealer_profile' } } }, cfg);
    expect(r.importVatSettlement.handling.value).toBe('unknown');
    expect(r.status).toBe('incomplete');
    expect(r.importVatSettlement.rows.some(row => row.handling === 'not_registered_pays_at_import')).toBe(false);
  });
});

/** Utvidelser (utviklerens): dekker akseptdatoens status i alle kursgrener, unngår duplikater og kontrollerer scenariofiltreringen. */
describe('SRC1 rettingsrunde: akseptdato uavhengig av kursgren; mva-kanaler forenlig med fradragsstatus', () => {
  const eur = (over: Partial<EconomicsInput> = {}): EconomicsInput => {
    const i = base();
    return { ...i, price: { ...i.price, currency: 'EUR', advertisedNet: '10000' }, ...over };
  };
  const acq = { pair: 'EUR/NOK', rate: '10', source: { kind: 'bank' as const }, effectiveAt: '2026-10-18', quotedAt: '2026-10-18' };
  const cust = { pair: 'EUR/NOK', raw: { rate: '10,817', unit: 1 as const }, source: { kind: 'official_customs' as const }, effectiveAt: null, quotedAt: '2026-10-19', validFrom: '2026-10-15', validTo: '2026-10-28', suspension: 'not_suspended_confirmed' as const };
  it('faktisk akseptdato består i NOK, med fallback og med direkte tollkurs (ingen dato-årsak)', () => {
    const actual = { date: '2026-10-20', kind: 'actual_acceptance' as const };
    const nok = calculateEconomics({ ...base(), customsDate: actual }, cfg);
    expect(nok.status).toBe('validated');
    const fb = calculateEconomics(eur({ customsDate: actual, fx: { acquisition: acq, customsFallback: 'use_acquisition_rate_assumed' } }), cfg);
    expect(fb.incompleteReasons).not.toContain('customs_acceptance_date_unknown');
    expect(fb.estimateReasons).not.toContain('customs_acceptance_date_expected');
    const direct = calculateEconomics(eur({ customsDate: actual, fx: { acquisition: acq, customs: cust } }), cfg);
    expect(direct.status).toBe('validated');
  });
  it('forventet dato gir estimatårsak i NOK, med fallback og med tollkurs uten periode; aldri duplisert', () => {
    const expected = { date: '2026-10-20', kind: 'expected_scenario' as const };
    for (const r of [
      calculateEconomics({ ...base(), customsDate: expected }, cfg),
      calculateEconomics(eur({ customsDate: expected, fx: { acquisition: acq, customsFallback: 'use_acquisition_rate_assumed' } }), cfg),
      calculateEconomics(eur({ customsDate: expected, fx: { acquisition: acq, customs: { ...cust, validFrom: null, validTo: null } } }), cfg),
      calculateEconomics(eur({ customsDate: expected, fx: { acquisition: acq, customs: cust } }), cfg),
    ]) {
      expect(r.estimateReasons.filter((x) => x === 'customs_acceptance_date_expected')).toHaveLength(1);
      expect(r.dates.customsAcceptance.kind).toBe('expected_scenario');
    }
  });
  it('ukjent dato er incomplete i alle grener og registreres én gang; perioden kontrolleres fortsatt i tollkursgrenen', () => {
    for (const r of [
      calculateEconomics(base(), cfg),
      calculateEconomics(eur({ fx: { acquisition: acq, customsFallback: 'use_acquisition_rate_assumed' } }), cfg),
      calculateEconomics(eur({ fx: { acquisition: acq, customs: cust } }), cfg),
    ]) {
      expect(r.status).toBe('incomplete');
      expect(r.incompleteReasons.filter((x) => x === 'customs_acceptance_date_unknown')).toHaveLength(1);
      expect(r.dates.customsAcceptance).toEqual({ date: null, kind: 'unknown', rateValidOnDate: null });
    }
    const outside = calculateEconomics(eur({ customsDate: { date: '2026-10-29', kind: 'actual_acceptance' }, fx: { acquisition: acq, customs: cust } }), cfg);
    expect(outside.status).toBe('blocked');
  });
  it('ukjent håndtering: scenarioer følger akseptert fradragsstatus, og ukjent håndtering blir aldri registrert ved slutning', () => {
    const at = { customsDate: { date: '2026-10-18', kind: 'actual_acceptance' as const }, vatHandling: null };
    const rec = calculateEconomics({ ...base(), ...at, deduction: { value: 'recoverable', source: { kind: 'dealer_profile' } } }, cfg);
    expect(rec.importVatSettlement.handling).toEqual({ value: 'unknown', accepted: false, source: null });
    expect(rec.importVatSettlement.status).toBe('scenarios');
    expect(rec.importVatSettlement.rows.map((r) => r.handling)).toEqual(['registered_reports_in_vat_return']);
    expect(rec.importVatSettlement.excludedScenarios.map((e) => e.handling)).toEqual(['not_registered_pays_at_import']);
    expect(rec.incompleteReasons).toContain('vat_handling_unknown');
    for (const value of ['non_recoverable', 'unknown'] as const) {
      const r = calculateEconomics({ ...base(), ...at, deduction: { value, source: { kind: 'dealer_profile' } } }, cfg);
      expect(r.importVatSettlement.rows.map((x) => x.handling), value).toEqual(['registered_reports_in_vat_return', 'not_registered_pays_at_import']);
      expect(r.importVatSettlement.excludedScenarios).toEqual([]);
    }
    // eksplisitt håndtering er upåvirket; selvmotsigende eksplisitt kombinasjon blokkeres fortsatt
    const explicit = calculateEconomics({ ...base(), customsDate: at.customsDate }, cfg);
    expect(explicit.importVatSettlement).toMatchObject({ status: 'known', excludedScenarios: [] });
    const contradiction = calculateEconomics({ ...base(), customsDate: at.customsDate, vatHandling: { value: 'not_registered_pays_at_import', source: { kind: 'dealer_entered' } }, deduction: { value: 'recoverable', source: { kind: 'dealer_entered' } } }, cfg);
    expect(contradiction.blockers.map((b) => b.code)).toEqual(['inconsistent_vat_status']);
  });
});
