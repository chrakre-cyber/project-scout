import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('@/app/searches/[id]/preview/[listingId]/dealer-input/actions',()=>({confirmDealerInputAction:vi.fn()}));
import { DealerInputForm } from '@/components/search/DealerInputForm';
import { makeBindingMarker } from '@/server/public-ids';

// Tilpasset den nye trygge kontrakten (ECON-006b-FIX1): komponenten får en opak konfliktmarkør i stedet for `candidate`/`draftVersion`. Kravet er uendret: rå leverandør-ID i klientutdata.
it('keeps provider listing identity out of client form markup',()=>{
  const rawId='provider-private-listing-783129';
  const candidate={id:`14:synthetic-demo/${rawId}`,version:'revision-hash'};
  const h=renderToStaticMarkup(createElement(DealerInputForm,{
    searchId:'11111111-1111-4111-8111-111111111111',listingId:'m1_abcdefghijklmnopqrstuvwx',
    bindingMarker:makeBindingMarker({environment:'synthetic',searchId:'11111111-1111-4111-8111-111111111111',publicId:'m1_abcdefghijklmnopqrstuvwx',draftVersion:4,candidate}),
    initial:{},prefill:'none',lines:[],profile:{vatHandling:'unknown',deduction:'unknown'},staleReasons:[],backHref:'/searches'
  }));
  expect(h).not.toContain(rawId);
  expect(h).not.toContain('revision-hash');
});
