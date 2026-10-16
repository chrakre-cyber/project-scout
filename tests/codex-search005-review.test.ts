import { expect, it } from 'vitest';
import { parseSearchFormValues } from '@/server/search-form';
import { DEMO_CATALOG } from '@/adapters/search-catalog/demo-catalog';
import { EXAMPLES } from '@/server/search-examples';
function base(){return EXAMPLES.find(x=>x.id==='demo-bmw')!.values();}
it('custom cost with chosen EUR but missing description must not silently disappear',()=>{
 const values={...base(),'custom.0.label':'','custom.0.amount':'','custom.0.currency':'EUR'};
 const r=parseSearchFormValues(values,DEMO_CATALOG);
 expect(r.ok).toBe(false);
 expect(r.errors['custom.0.label']).toBeTruthy();
 expect(r.json).toBeNull();
});
it('custom cost marked included with selected VAT basis must not silently disappear',()=>{
 const values={...base(),'custom.0.label':'','custom.0.amount':'','custom.0.currency':'NOK','custom.0.vat':'incl','custom.0.included':'true'};
 const r=parseSearchFormValues(values,DEMO_CATALOG);
 expect(r.ok).toBe(false);
 expect(r.errors['custom.0.label']).toBeTruthy();
 expect(r.json).toBeNull();
});
