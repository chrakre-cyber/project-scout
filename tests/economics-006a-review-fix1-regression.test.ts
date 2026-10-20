import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { calculateEconomics, UNCONFIRMED_HALF_UP, type EconomicsInput } from '@/domain/economics';
import { explainEconomics, toEconomicsDisplayStatus, toEconomicsView, type MappingOutcome } from '@/domain/search-economics';
import { EconomicsNote } from '@/components/search/EconomicsNote';
import { ECON_CASES } from './fixtures/econ-golden';
const excluded = {state:'excluded_by_scenario',reason:'test'} as const;
const input = (over:Partial<EconomicsInput> = {}): EconomicsInput => ({
  fx:{},
  price:{currency:'NOK',advertisedNet:'100000',priceBasis:'net',use:'advertised',evidence:'listing_claim',foreignVat:{treatment:'excluded_documented',evidence:'invoice_or_contract'}},
  transportToBorder:{amount:'8000',basis:'dealer_entered'}, transportAfterBorder:excluded,
  insurance:{amount:'0',basis:'dealer_entered'}, loadingHandling:excluded,
  customsDate:{date:'2026-10-20',kind:'actual_acceptance'}, taxInput:ECON_CASES[2]!.golden.input,
  deduction:{value:'non_recoverable',source:{kind:'dealer_entered'}},
  vatHandling:{value:'registered_reports_in_vat_return',source:{kind:'dealer_entered'}},
  charges:{climateGas:excluded,registrationFee:excluded,customsDuty:excluded},asOf:'2026-10-20',...over
});
const calc = (over:Partial<EconomicsInput> = {}) => calculateEconomics(input(over),{rounding:UNCONFIRMED_HALF_UP});
const outcome:MappingOutcome = {class:'incomplete',assessment:null,lines:[{id:'c',kind:'custom',label:'Chosen fee',amountMinor:150n,treatment:'added_to_total',counted:true,reason:null}],reasons:[],validUntil:null,bindingLimit:null};
it('renders a known search cost with 50 ore as a known monetary amount',()=>{
  const result=calc();
  const display=toEconomicsDisplayStatus({result,outcome,rights:{canDerive:true,canDisplay:true}});
  const e=toEconomicsView(display,{state:'in_use'},[],{result,outcome});
  const h=renderToStaticMarkup(createElement(EconomicsNote,{economics:e}));
  const section=h.split('data-testid="economics-lines"')[1]!.split('</section>')[0]!;
  expect(section).toContain('Chosen fee');
  expect(section).not.toContain('ukjent beløp');
});
it('keeps a known registration fee visible when transport makes the total incomplete',()=>{
  const result=calc({transportToBorder:undefined,charges:{climateGas:excluded,registrationFee:{amount:'1000',basis:'dealer_entered'},customsDuty:excluded}});
  expect(result.importCashRequirement.kind).toBe('lower_bound');
  const x=explainEconomics({result,outcome:null,notes:[]});
  expect(x.breakdown.some(r=>r.inGrossOutlay && r.amountNok==='1000')).toBe(true);
});
it('does not label assumed insurance as an ordinary known stated input',()=>{
  const result=calc({insurance:{amount:'500',basis:'assumed_default'}});
  expect(result.estimateReasons).toContain('assumed_default_amount');
  const x=explainEconomics({result,outcome:null,notes:[]});
  expect(x.breakdown.find(r=>r.id==='insurance')).toMatchObject({state:'assumed',basis:'assumed',amountNok:'500'});
});

it('does not count scenario-excluded charges as known cost items', () => {
  const result=calc({charges:{climateGas:excluded,registrationFee:excluded,customsDuty:excluded}});
  const x=explainEconomics({result,outcome:null,notes:[]});
  const excludedRows=x.breakdown.filter(r=>['climate_gas','registration_fee'].includes(r.id));
  expect(excludedRows.filter(r=>r.state==='known')).toEqual([]);
});
