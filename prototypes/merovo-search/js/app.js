/*
 * Brukergrensesnitt for forhåndsvisningen SEARCH-001A-UI. Ingen nettverk, ingen lagring i nettleseren.
 * All bruker- og importtekst settes med textContent/value, aldri som HTML.
 */
(function () {
  "use strict";
  const D = window.MerovoData;
  const L = window.MerovoLogic;

  let state = L.emptyState();
  let dirty = false;
  const syncers = [];
  const errSlots = [];
  let lastModelChange = null;

  // ------------------------------------------------------------------ DOM-hjelpere
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid);
    }
    return el;
  }
  const $ = (sel, root) => (root || document).querySelector(sel);
  let uid = 0;
  const nextId = (p) => p + "-" + ++uid;

  /** Feilplass for ett delfelt: kobles til input via aria-describedby/aria-invalid. */
  function errSlot(fieldId, sub, inputs) {
    const id = nextId("err");
    const p = h("p", { class: "error", id, hidden: true });
    const list = Array.isArray(inputs) ? inputs : [inputs];
    for (const inp of list) {
      const prev = inp.getAttribute("aria-describedby");
      inp.setAttribute("aria-describedby", prev ? prev + " " + id : id);
    }
    errSlots.push({ key: fieldId, sub, p, inputs: list });
    return p;
  }
  function renderErrors(errors) {
    for (const s of errSlots) {
      const msg = errors[s.key] && errors[s.key][s.sub];
      s.p.hidden = !msg;
      s.p.textContent = msg || "";
      for (const inp of s.inputs) {
        if (msg) inp.setAttribute("aria-invalid", "true");
        else inp.removeAttribute("aria-invalid");
      }
    }
  }
  const helpP = (text, id) => (text ? h("p", { class: "help", id, text }) : null);

  // ------------------------------------------------------------------ tilstandsendring
  function changed() {
    dirty = true;
    update();
  }
  function update() {
    for (const f of prioRefs) f();
    const errors = L.validate(state);
    renderErrors(errors);
    renderBudgetLimit();
    renderSummary(errors);
  }
  function syncAll() {
    for (const s of syncers) s();
    update();
  }

  // ------------------------------------------------------------------ feltbyggere
  const prioRefs = [];

  function prioControl(key, label, isSelected) {
    const name = nextId("prio");
    const mk = (o) => {
      const input = h("input", { type: "radio", name, value: o.v });
      input.addEventListener("change", () => { state.eq[key] = o.v; changed(); });
      return { o, input, label: h("label", { class: "seg" }, input, h("span", { text: o.l })) };
    };
    const items = D.PRIORITY.map(mk);
    const fs = h("fieldset", { class: "prio", hidden: true }, h("legend", { class: "sr", text: "Prioritet for " + label }), items.map((i) => i.label));
    const sync = () => {
      const sel = isSelected();
      fs.hidden = !sel;
      const p = state.eq[key] || "must";
      for (const i of items) i.input.checked = i.o.v === p;
    };
    prioRefs.push(sync);
    syncers.push(sync);
    return fs;
  }

  function selectEl(id, options, allLabel) {
    return h("select", { id }, h("option", { value: "", text: allLabel || "Alle" }), options.map((o) => h("option", { value: o.v, text: o.l })));
  }

  function buildSelect(f) {
    const sel = selectEl(nextId("f"), f.options);
    sel.addEventListener("change", () => { state.values[f.id] = sel.value; changed(); });
    syncers.push(() => { sel.value = state.values[f.id]; });
    return h("div", { class: "field" + (f.demo ? " is-demo" : "") },
      h("label", { class: "label", for: sel.id }, f.label, f.demo ? h("span", { class: "demo-tag", text: "demonstrasjonsutvalg" }) : null),
      sel, helpP(f.help, null));
  }

  function checkRow(opt, name, onChange, extraClass) {
    const input = h("input", { type: "checkbox", name, value: opt.v });
    input.addEventListener("change", () => onChange(opt.v, input.checked));
    const sw = opt.c ? h("span", { class: "swatch", style: "background:" + opt.c, "aria-hidden": "true" }) : opt.c === "" ? h("span", { class: "swatch swatch-other", "aria-hidden": "true" }) : null;
    return { input, el: h("label", { class: "check " + (extraClass || "") }, input, sw, h("span", { text: opt.l })) };
  }

  function buildMulti(f) {
    const name = nextId("m");
    const rows = f.options.map((o) => checkRow(o, name, (v, on) => {
      const arr = state.values[f.id];
      const i = arr.indexOf(v);
      if (on && i < 0) arr.push(v);
      if (!on && i >= 0) arr.splice(i, 1);
      changed();
    }));
    syncers.push(() => { for (const r of rows) r.input.checked = state.values[f.id].includes(r.input.value); });
    const hid = f.help ? nextId("help") : null;
    const fs = h("fieldset", { class: "field" + (f.demo ? " is-demo" : ""), "aria-describedby": hid },
      h("legend", { class: "label" }, f.label, f.demo ? h("span", { class: "demo-tag", text: "demonstrasjonsutvalg" }) : null),
      h("div", { class: "checks cols" + (f.options.length > 7 ? " cols-many" : "") }, rows.map((r) => r.el)), helpP(f.help, hid));
    return fs;
  }

  function buildRadio(f) {
    const name = nextId("r");
    const rows = f.options.map((o) => {
      const input = h("input", { type: "radio", name, value: o.v });
      input.addEventListener("change", () => { state.values[f.id] = o.v; changed(); });
      return { input, el: h("label", { class: "check" }, input, h("span", { text: o.l })) };
    });
    syncers.push(() => { for (const r of rows) r.input.checked = r.input.value === state.values[f.id]; });
    const hid = f.help ? nextId("help") : null;
    return h("fieldset", { class: "field", "aria-describedby": hid }, h("legend", { class: "label", text: f.label }), h("div", { class: "checks" }, rows.map((r) => r.el)), helpP(f.help, hid));
  }

  function numInput(label, unit, onInput, getRaw, inputmode) {
    const input = h("input", { type: "text", inputmode: inputmode || "numeric", "aria-label": label, autocomplete: "off", spellcheck: "false" });
    input.addEventListener("input", () => onInput(input.value));
    const wrap = h("span", { class: "input-unit" }, input, unit ? h("span", { class: "unit", text: unit }) : null);
    syncers.push(() => { input.value = getRaw(); });
    return { input, wrap };
  }

  function buildRange(f) {
    const a = numInput(f.fromLabel, f.hideUnit ? "" : f.unit, (v) => { state.values[f.id].from = v; changed(); }, () => state.values[f.id].from);
    const b = numInput(f.toLabel, f.hideUnit ? "" : f.unit, (v) => { state.values[f.id].to = v; changed(); }, () => state.values[f.id].to);
    const hid = f.help ? nextId("help") : null;
    return h("fieldset", { class: "field", "aria-describedby": hid },
      h("legend", { class: "label", text: f.label }),
      h("div", { class: "pair" }, h("label", { class: "sub" }, h("span", { text: "Fra" }), a.wrap), h("label", { class: "sub" }, h("span", { text: "Til" }), b.wrap)),
      errSlot(f.id, "from", a.input), errSlot(f.id, "to", b.input), helpP(f.help, hid));
  }

  function buildRegRange(f) {
    const a = numInput("Førstegangsregistrering fra", "ÅÅÅÅ[-MM]", (v) => { state.values[f.id].from = v; changed(); }, () => state.values[f.id].from, "text");
    const b = numInput("Førstegangsregistrering til", "ÅÅÅÅ[-MM]", (v) => { state.values[f.id].to = v; changed(); }, () => state.values[f.id].to, "text");
    const hid = f.help ? nextId("help") : null;
    return h("fieldset", { class: "field", "aria-describedby": hid },
      h("legend", { class: "label", text: f.label }),
      h("div", { class: "pair" }, h("label", { class: "sub" }, h("span", { text: "Fra" }), a.wrap), h("label", { class: "sub" }, h("span", { text: "Til" }), b.wrap)),
      errSlot(f.id, "from", a.input), errSlot(f.id, "to", b.input), helpP(f.help, hid));
  }

  function buildMax(f) {
    const a = numInput(f.label, f.unit, (v) => { state.values[f.id] = v; changed(); }, () => state.values[f.id]);
    const id = nextId("f");
    a.input.id = id;
    const hid = f.help ? nextId("help") : null;
    return h("div", { class: "field" }, h("label", { class: "label", for: id, text: f.label }), a.wrap, errSlot(f.id, "value", a.input), helpP(f.help, hid));
  }

  function buildMonth(f) {
    const a = numInput(f.label, "ÅÅÅÅ-MM", (v) => { state.values[f.id] = v; changed(); }, () => state.values[f.id], "text");
    const id = nextId("f");
    a.input.id = id;
    return h("div", { class: "field" }, h("label", { class: "label", for: id, text: f.label }), a.wrap, errSlot(f.id, "value", a.input), helpP(f.help, null));
  }

  function buildText(f) {
    const input = h("input", { type: "text", id: nextId("f"), maxlength: String(f.max + 50), autocomplete: "off", spellcheck: "false" });
    input.addEventListener("input", () => { state.values[f.id] = input.value; changed(); });
    syncers.push(() => { input.value = state.values[f.id]; });
    return h("div", { class: "field" }, h("label", { class: "label", for: input.id, text: f.label }), input, errSlot(f.id, "value", input), helpP(f.help, null));
  }

  function buildColors(f) {
    const name = nextId("c");
    const rows = f.options.map((o) => checkRow(o, name, (v, on) => {
      const arr = state.values[f.id];
      const i = arr.indexOf(v);
      if (on && i < 0) arr.push(v);
      if (!on && i >= 0) arr.splice(i, 1);
      changed();
    }, "color-check"));
    syncers.push(() => { for (const r of rows) r.input.checked = state.values[f.id].includes(r.input.value); });
    const hid = f.help ? nextId("help") : null;
    return h("fieldset", { class: "field", "aria-describedby": hid }, h("legend", { class: "label", text: f.label }), h("div", { class: "checks cols cols-many" }, rows.map((r) => r.el)), helpP(f.help, hid));
  }

  function buildPrioSelect(f) {
    const sel = selectEl(nextId("f"), f.options, "Alle");
    sel.addEventListener("change", () => {
      state.values[f.id] = sel.value;
      if (sel.value) state.eq[f.id] = state.eq[f.id] || "must";
      else delete state.eq[f.id];
      changed();
    });
    syncers.push(() => { sel.value = state.values[f.id]; });
    const prio = prioControl(f.id, f.label, () => state.values[f.id] !== "");
    return h("div", { class: "field" }, h("label", { class: "label", for: sel.id, text: f.label }), h("div", { class: "select-prio" }, sel, prio), helpP(f.help, null));
  }

  function buildWeight(f) {
    const tsel = selectEl(nextId("f"), L.WEIGHT_TYPES, "Velg vekttype");
    tsel.setAttribute("aria-label", "Vekttype");
    tsel.addEventListener("change", () => { state.values[f.id].type = tsel.value; changed(); });
    const a = numInput("Maks vekt", "kg", (v) => { state.values[f.id].max = v; changed(); }, () => state.values[f.id].max);
    syncers.push(() => { tsel.value = state.values[f.id].type; });
    return h("fieldset", { class: "field" }, h("legend", { class: "label", text: f.label }),
      h("div", { class: "pair" }, tsel, a.wrap), errSlot(f.id, "type", tsel), errSlot(f.id, "max", a.input), helpP(f.help, null));
  }

  function buildConsumption(f) {
    const usel = selectEl(nextId("f"), L.CONSUMPTION_UNITS, "Velg enhet");
    usel.setAttribute("aria-label", "Forbruksenhet");
    usel.addEventListener("change", () => { state.values[f.id].unit = usel.value; changed(); });
    const a = numInput("Maks forbruk", "pr. 100 km", (v) => { state.values[f.id].max = v; changed(); }, () => state.values[f.id].max, "decimal");
    syncers.push(() => { usel.value = state.values[f.id].unit; });
    return h("fieldset", { class: "field" }, h("legend", { class: "label", text: f.label }),
      h("div", { class: "pair" }, usel, a.wrap), errSlot(f.id, "unit", usel), errSlot(f.id, "max", a.input), helpP(f.help, null));
  }

  // Effekt: kanonisk verdi i watt slik at hk/kW-bytte er tapsfritt.
  function buildPower(f) {
    const radios = ["hp", "kw"].map((u) => {
      const input = h("input", { type: "radio", name: "power-unit", value: u });
      input.addEventListener("change", () => switchUnit(u));
      return { u, input, el: h("label", { class: "check" }, input, h("span", { text: u === "hp" ? "hk" : "kW" })) };
    });
    const conv = () => (state.values.power.unit === "hp" ? [(x) => L.hpToW(x), (w) => L.wToHp(w)] : [(x) => L.kwToW(x), (w) => L.wToKw(w)]);
    const setSide = (side, v) => {
      const p = state.values.power;
      p[side] = v;
      const r = L.parseIntBounded(v, 1, 100000);
      p[side + "W"] = r.value === undefined ? null : conv()[0](r.value);
      changed();
    };
    const a = numInput("Effekt fra", "", (v) => setSide("from", v), () => state.values.power.from);
    const b = numInput("Effekt til", "", (v) => setSide("to", v), () => state.values.power.to);
    const unitA = h("span", { class: "unit", id: nextId("pu") });
    const unitB = h("span", { class: "unit" });
    a.wrap.append(unitA);
    b.wrap.append(unitB);
    function switchUnit(u) {
      const p = state.values.power;
      p.unit = u;
      for (const side of ["from", "to"]) if (p[side + "W"] !== null) p[side] = String(conv()[1](p[side + "W"]));
      syncPower();
      changed();
    }
    function syncPower() {
      const p = state.values.power;
      for (const r of radios) r.input.checked = r.u === p.unit;
      unitA.textContent = unitB.textContent = p.unit === "hp" ? "hk" : "kW";
      a.input.value = p.from;
      b.input.value = p.to;
    }
    syncers.push(syncPower);
    return h("fieldset", { class: "field" }, h("legend", { class: "label", text: f.label }),
      h("div", { class: "pair" }, h("label", { class: "sub" }, h("span", { text: "Fra" }), a.wrap), h("label", { class: "sub" }, h("span", { text: "Til" }), b.wrap),
        h("div", { class: "unit-radios", role: "group", "aria-label": "Enhet for effekt" }, radios.map((r) => r.el))),
      errSlot("power", "from", a.input), errSlot("power", "to", b.input),
      helpP("Verdiene omregnes tapsfritt mellom hk og kW (1 hk = 0,73549875 kW). Visningen er avrundet til hele tall.", null));
  }

  // ---- merke / modell / variant / pakker (modellavhengige)
  function buildVehicleIdentity(sectionFields) {
    const f = Object.fromEntries(sectionFields.map((x) => [x.id, x]));
    const brandSel = selectEl(nextId("f"), D.BRANDS, "Alle merker");
    const modelSel = selectEl(nextId("f"), [], "Alle modeller");
    const variantIn = h("input", { type: "text", id: nextId("f"), list: nextId("dl"), autocomplete: "off", spellcheck: "false", placeholder: "for eksempel AMG Line" });
    const dl = h("datalist", { id: variantIn.getAttribute("list") });
    const pkgBox = h("div", { class: "checks cols" });
    const notice = h("div", { class: "notice", role: "status", hidden: true });

    const modelsOf = (b) => D.MODELS[b] || [];
    const snapshot = () => ({ brand: state.values.brand, model: state.values.model, variant: state.values.variant, packages: state.values.packages.slice() });

    function onVehicleChange(mutate) {
      const before = snapshot();
      mutate();
      const removed = L.reconcileModelDependent(state);
      lastModelChange = before;
      const parts = [];
      if (before.model && !state.values.model) parts.push("modellen");
      if (removed.variant) parts.push("varianten «" + removed.variant + "»");
      if (removed.packages.length) parts.push("pakke" + (removed.packages.length > 1 ? "ne " : "n ") + removed.packages.map((p) => "«" + p + "»").join(", "));
      showNotice(parts.length ? "Fjernet fordi det ikke hører til valgt merke/modell: " + parts.join(", ") + "." : "");
      syncAll();
      dirty = true;
    }
    function showNotice(msg) {
      notice.replaceChildren();
      notice.hidden = !msg;
      if (!msg) return;
      notice.append(h("span", { text: msg + " " }),
        h("button", { type: "button", class: "btn-link", onclick: () => {
          const b = lastModelChange;
          state.values.brand = b.brand; state.values.model = b.model; state.values.variant = b.variant; state.values.packages = b.packages;
          showNotice("");
          syncAll();
        } }, "Angre modellbyttet"),
        h("button", { type: "button", class: "btn-link", onclick: () => { showNotice(""); brandSel.focus(); } }, "Behold fjerningen"));
    }

    brandSel.addEventListener("change", () => onVehicleChange(() => { state.values.brand = brandSel.value; state.values.model = ""; }));
    modelSel.addEventListener("change", () => onVehicleChange(() => { state.values.model = modelSel.value; }));
    variantIn.addEventListener("input", () => { state.values.variant = variantIn.value; changed(); });

    function renderPackages() {
      pkgBox.replaceChildren();
      const info = L.modelInfo(state.values.brand, state.values.model);
      if (!info) { pkgBox.append(h("p", { class: "help", text: "Velg modell for å se utstyrspakker (demonstrasjonsutvalg)." })); return; }
      if (!info.packages.length) { pkgBox.append(h("p", { class: "help", text: "Ingen pakker i demonstrasjonsutvalget for denne modellen." })); return; }
      for (const p of info.packages) {
        const r = checkRow({ v: p, l: p }, "pkg", (v, on) => {
          const arr = state.values.packages;
          const i = arr.indexOf(v);
          if (on && i < 0) arr.push(v);
          if (!on && i >= 0) arr.splice(i, 1);
          changed();
        });
        r.input.checked = state.values.packages.includes(p);
        pkgBox.append(r.el);
      }
    }
    syncers.push(() => {
      const v = state.values;
      brandSel.value = v.brand;
      modelSel.replaceChildren(h("option", { value: "", text: "Alle modeller" }), ...modelsOf(v.brand).map((m) => h("option", { value: m.v, text: m.l })));
      modelSel.disabled = !v.brand;
      modelSel.value = v.model;
      variantIn.value = v.variant;
      variantIn.disabled = !v.model;
      const info = L.modelInfo(v.brand, v.model);
      dl.replaceChildren(...(info ? info.variants : []).map((x) => h("option", { value: x })));
      renderPackages();
    });

    const demo = h("span", { class: "demo-tag", text: "demonstrasjonsutvalg" });
    const brandBox = h("div", { class: "field is-demo" }, h("label", { class: "label", for: brandSel.id }, "Merke", demo.cloneNode(true)), brandSel);
    const modelBox = h("div", { class: "field is-demo" }, h("label", { class: "label", for: modelSel.id }, "Modell", demo.cloneNode(true)), modelSel);
    const variantBox = h("div", { class: "field" }, h("label", { class: "label", for: variantIn.id, text: "Variant" }), variantIn, dl, errSlot("variant", "value", variantIn), helpP(f.variant.help, null));
    errSlot("model", "value", modelSel);
    const pkgFs = h("fieldset", { class: "field is-demo" }, h("legend", { class: "label" }, "Utstyrspakke (modellavhengig)", demo.cloneNode(true)), pkgBox);
    return h("div", { class: "identity" }, h("div", { class: "row3" }, brandBox, modelBox, variantBox), notice, pkgFs);
  }

  // ---- utstyr (avkrysning med Må ha / Ønskelig, «Vis flere», lokalt søk)
  function buildEquipGroup(g) {
    const name = nextId("eq");
    const items = g.items.map(([key, label], i) => {
      const input = h("input", { type: "checkbox", name, value: key });
      input.addEventListener("change", () => {
        if (input.checked) state.eq[key] = state.eq[key] || "must";
        else delete state.eq[key];
        changed();
        render();
      });
      const prio = prioControl(key, label, () => Boolean(state.eq[key]));
      const el = h("div", { class: "equip-item" }, h("label", { class: "check" }, input, h("span", { text: label })), prio);
      return { key, label, input, el, extra: i >= g.visible };
    });
    let expanded = false;
    let query = "";
    const more = g.items.length > g.visible ? h("button", { type: "button", class: "btn-link more", "aria-expanded": "false" }) : null;
    const search = g.searchable ? h("input", { type: "search", class: "equip-search", "aria-label": "Søk i utstyr: " + g.title, placeholder: "Søk i utstyr …", autocomplete: "off" }) : null;
    const none = h("p", { class: "help", hidden: true, text: "Ingen utstyr samsvarer med søket." });
    const live = h("p", { class: "sr", "aria-live": "polite" });
    const list = h("div", { class: "equip-list" }, items.map((i) => i.el));
    const norm = (s) => s.normalize("NFC").toLowerCase();
    function render() {
      const q = norm(query.trim());
      let shown = 0;
      for (const i of items) {
        const match = q === "" || norm(i.label).includes(q);
        const show = q ? match : !i.extra || expanded || Boolean(state.eq[i.key]);
        i.el.hidden = !show;
        if (show) shown++;
      }
      none.hidden = !(q && shown === 0);
      live.textContent = q ? shown + " treff" : "";
      if (more) {
        more.hidden = Boolean(q);
        const hiddenCount = items.filter((i) => i.extra && !state.eq[i.key]).length;
        more.textContent = expanded ? "Vis færre" : "Vis flere (" + hiddenCount + ")";
        more.setAttribute("aria-expanded", String(expanded));
      }
    }
    if (more) more.addEventListener("click", () => { expanded = !expanded; render(); });
    if (search) search.addEventListener("input", () => { query = search.value; render(); });
    syncers.push(() => { for (const i of items) i.input.checked = Boolean(state.eq[i.key]); render(); });
    return h("fieldset", { class: "field equip" }, h("legend", { class: "label", text: g.title }), search, list, none, live, more);
  }

  // ------------------------------------------------------------------ budsjett
  const limitBox = h("div", { class: "limit", "aria-live": "polite" });
  let costsHost = null;

  function buildBudget() {
    const amount = numInput("Maks innkjøpskostnad til Norge i NOK", "kr", (v) => { state.budget.amount = v; changed(); }, () => state.budget.amount, "decimal");
    amount.input.id = "budget-amount";
    const devOn = h("input", { type: "checkbox", id: "budget-dev-on" });
    const dev = numInput("Prisavvik i prosent over budsjettet", "%", (v) => { state.budget.deviation = v; changed(); }, () => state.budget.deviation, "decimal");
    dev.input.id = "budget-dev";
    devOn.addEventListener("change", () => { state.budget.deviationOn = devOn.checked; changed(); });
    syncers.push(() => { devOn.checked = state.budget.deviationOn; dev.input.disabled = !state.budget.deviationOn; });
    devOn.addEventListener("change", () => { dev.input.disabled = !devOn.checked; });

    costsHost = h("div", { class: "costs" });
    syncers.push(renderCosts);
    const add = h("button", { type: "button", class: "btn btn-secondary", id: "btn-add-cost", onclick: () => {
      if (state.budget.costs.length >= D.LIMITS.maxCosts) return;
      const c = L.newCost("", "");
      state.budget.costs.push(c);
      renderCosts();
      changed();
      const inp = costsHost.querySelector('[data-cost="' + c.id + '"] input[data-role="label"]');
      if (inp) inp.focus();
    } }, "Legg til egen kostnad");

    return h("div", { class: "budget" },
      h("div", { class: "field" },
        h("label", { class: "label", for: "budget-amount", text: "Maks innkjøpskostnad til Norge, inkl. beregnede norske avgifter" }),
        amount.wrap,
        errSlot("budget.amount", "value", amount.input),
        h("p", { class: "help", text: "Beløp i NOK, større enn 0. Budsjettsummen skal omfatte kjøpsgrunnlaget i lokal valuta, eventuell dokumentert reduksjon av lokal mva., omregning, norske avgifter og valgte tilleggskostnader. Det er en budsjettsum, ikke nødvendigvis endelig økonomisk kostnad eller kontantutlegg ved grensen. Forhåndsvisningen beregner ingen av delene, og ingen salgspris eller margin kreves." })),
      h("div", { class: "field" },
        h("div", { class: "dev-row" },
          h("label", { class: "check", for: "budget-dev-on" }, devOn, h("span", { text: "Vis også biler inntil" })),
          dev.wrap,
          h("span", { class: "dev-tail", text: "over budsjettet" })),
        errSlot("budget.deviation", "value", dev.input),
        h("p", { class: "help", text: "Valgfritt og av som standard. 0–100 % med opptil to desimaler. Prisavvik gir aldri adgang til å ignorere bilkrav." })),
      limitBox,
      h("div", { class: "field" },
        h("div", { class: "label", text: "Kostnadsforutsetninger" }),
        h("p", { class: "help", text: "Transport, reise, forsikring, klargjøring og egne linjer. Tomt felt betyr ukjent. 0 er et uttrykkelig valg («ikke aktuell»). Linjene er forutsetninger: de legges ikke til budsjettgrensen og gir ingen beregnet total." }),
        costsHost, add));
  }

  function renderCosts() {
    // Bygges på nytt ved endring i antall linjer eller ved import/tømming. Feilplasser for kostnadslinjer fjernes og gjenskapes.
    for (let i = errSlots.length - 1; i >= 0; i--) if (errSlots[i].key.startsWith("cost.")) errSlots.splice(i, 1);
    costsHost.replaceChildren();
    for (const c of state.budget.costs) costsHost.append(costRow(c));
  }

  function costRow(c) {
    const key = "cost." + c.id;
    const nameLabel = c.fixed ? (D.FIXED_COSTS.find((x) => x.key === c.id) || {}).label : "";
    const labelIn = c.fixed ? null : h("input", { type: "text", "data-role": "label", "aria-label": "Navn på kostnad", maxlength: "120", value: c.label, placeholder: "Navn, for eksempel Tollagring", autocomplete: "off" });
    if (labelIn) labelIn.addEventListener("input", () => { c.label = labelIn.value; changed(); });
    const aria = c.fixed ? nameLabel : "egen kostnad";
    const amt = h("input", { type: "text", inputmode: "decimal", "aria-label": "Beløp for " + aria, value: c.amount, autocomplete: "off", spellcheck: "false" });
    amt.addEventListener("input", () => { c.amount = amt.value; changed(); });
    const cur = h("select", { "aria-label": "Valuta for " + aria }, D.CURRENCIES.map((x) => h("option", { value: x, text: x })));
    cur.value = c.currency;
    cur.addEventListener("change", () => { c.currency = cur.value; changed(); });
    const vat = h("select", { "aria-label": "Mva.-grunnlag for " + aria }, D.VAT_BASIS.map((o) => h("option", { value: o.v, text: o.l })));
    vat.value = c.vat;
    vat.addEventListener("change", () => { c.vat = vat.value; changed(); });
    const inc = h("input", { type: "checkbox" });
    inc.checked = c.included;
    inc.addEventListener("change", () => { c.included = inc.checked; changed(); });
    const remove = c.fixed ? null : h("button", { type: "button", class: "btn-link danger", "aria-label": "Fjern kostnadslinjen " + (c.label || "uten navn"), onclick: () => {
      state.budget.costs = state.budget.costs.filter((x) => x !== c);
      renderCosts();
      changed();
      $("#btn-add-cost").focus();
    } }, "Fjern");
    return h("div", { class: "cost", "data-cost": c.id },
      h("div", { class: "cost-name" }, c.fixed ? h("strong", { text: nameLabel }) : labelIn, remove),
      h("div", { class: "cost-fields" },
        h("label", { class: "sub" }, h("span", { text: "Beløp" }), amt),
        h("label", { class: "sub" }, h("span", { text: "Valuta" }), cur),
        h("label", { class: "sub" }, h("span", { text: "Mva.-grunnlag" }), vat),
        h("label", { class: "check cost-inc" }, inc, h("span", { text: "Inngår i budsjettet" }))),
      errSlot(key, "label", labelIn || amt), errSlot(key, "amount", amt));
  }

  function renderBudgetLimit() {
    const lim = L.budgetLimit(state.budget);
    limitBox.replaceChildren();
    limitBox.classList.toggle("is-empty", lim.state !== "ok");
    if (lim.state === "none") { limitBox.append(h("p", { text: "Skriv inn et budsjett for å se budsjettgrensen." })); return; }
    if (lim.state === "error") { limitBox.append(h("p", { text: "Budsjettgrensen vises når beløp og prosent er gyldige." })); return; }
    if (lim.bp === null) limitBox.append(h("p", {}, "Budsjettgrense: ", h("strong", { text: L.fmtMinor(lim.limitMinor) }), " (prisavvik er av)."));
    else limitBox.append(h("p", {}, "Høyeste tillatte budsjettgrense: ", h("strong", { text: L.fmtMinor(lim.limitMinor) }),
      " (" + L.fmtMinor(lim.budgetMinor) + " + " + L.fmtBp(lim.bp) + ", ev. brøkøre rundet ned)."));
    limitBox.append(h("p", { class: "help", text: "Bare budsjettaritmetikk. Ingen bilpris, avgift, mva. eller total er beregnet." }));
  }

  // ------------------------------------------------------------------ oppsummering
  const summaryEl = $("#summary");
  const mobileText = $("#mobilebar-text");
  const sections = D.SECTIONS;

  function chip(item, withText) {
    const remove = h("button", { type: "button", class: "chip-x", "aria-label": "Fjern: " + item.label, onclick: () => {
      item.clear(state);
      dirty = true;
      syncAll();
      $("#summary-title").focus();
    } }, "×");
    return h("li", { class: "chip" }, h("span", { class: "chip-text" }, h("b", { text: item.label + (withText && item.text ? ": " : "") }), withText && item.text ? " " + item.text : ""), remove);
  }

  function renderSummary(errors) {
    const sum = L.summarize(state);
    const nErr = L.errorCount(errors);
    const total = sum.criteria.length + sum.must.length + sum.nice.length;
    const lim = L.budgetLimit(state.budget);
    const root = [];
    root.push(h("h2", { id: "summary-title", tabindex: "-1", text: "Oppsummering" }));
    root.push(h("button", { type: "button", class: "btn-link sheet-close", id: "sheet-close", onclick: () => setSheet(false) }, "Lukk oppsummering"));
    root.push(h("p", { class: "draft-badge", text: "Utkast – ikke lagret i appens database. Ingen søk sendes." }));
    if (state.origin === "demo-example") root.push(h("p", { class: "example-badge", text: "Basert på demoeksempelet. Valgene er eksempler, ikke bekreftede ønsker." }));
    if (nErr) root.push(h("p", { class: "error-box", role: "status", text: nErr + (nErr === 1 ? " felt må rettes" : " felt må rettes") + " før eksport. Ugyldige verdier vises ikke i oppsummeringen." }));

    const bySection = new Map();
    for (const c of sum.criteria) {
      if (!bySection.has(c.section)) bySection.set(c.section, []);
      bySection.get(c.section).push(c);
    }
    root.push(h("h3", { text: "Bilkrav (gjelder alle samtidig)" }));
    if (!bySection.size) root.push(h("p", { class: "empty", text: "Ingen begrensninger valgt («Alle»)." }));
    for (const s of sections) {
      const items = bySection.get(s.id);
      if (!items) continue;
      root.push(h("h4", { text: s.title }), h("ul", { class: "chips" }, items.map((i) => chip(i, true))));
    }
    root.push(h("h3", { text: "Må ha" }));
    root.push(sum.must.length ? h("ul", { class: "chips" }, sum.must.map((i) => chip(i, true))) : h("p", { class: "empty", text: "Ingen valgt." }));
    root.push(h("h3", { text: "Ønskelig" }));
    root.push(sum.nice.length ? h("ul", { class: "chips" }, sum.nice.map((i) => chip(i, true))) : h("p", { class: "empty", text: "Ingen valgt." }));
    root.push(h("p", { class: "logic-note", text: "Bilkrav og «må ha» gjelder alle samtidig (OG). Flere valg i samme liste, som farger eller drivstoff, er alternativer (ELLER). «Ønskelig» påvirker rekkefølge og forklaring, ikke hva som tas med. Prisavvik opphever aldri et bilkrav." }));

    root.push(h("h3", { text: "Innkjøpsbudsjett til Norge" }));
    const dl = h("dl", { class: "kv" });
    const kv = (k, v) => dl.append(h("dt", { text: k }), h("dd", { text: v }));
    const amt = L.parseMoney(state.budget.amount);
    kv("Maks innkjøpskostnad", amt.minor !== undefined ? L.fmtMinor(amt.minor) : "ikke angitt");
    kv("Prisavvik", state.budget.deviationOn ? (L.parsePercentBp(state.budget.deviation).bp !== undefined ? L.fmtBp(L.parsePercentBp(state.budget.deviation).bp) : "ugyldig") : "av");
    if (lim.state === "ok" && lim.bp !== null) kv("Høyeste budsjettgrense", L.fmtMinor(lim.limitMinor));
    root.push(dl);
    const costs = h("ul", { class: "cost-list" });
    for (const c of state.budget.costs) {
      const name = c.fixed ? (D.FIXED_COSTS.find((x) => x.key === c.id) || {}).label : c.label.trim() || "(uten navn)";
      const a = L.parseMoney(c.amount, { allowZero: true });
      let t;
      if (a.error) t = "ugyldig beløp";
      else if (a.minor === undefined) t = "ukjent";
      else if (a.minor === 0n) t = "0 " + c.currency + " (uttrykkelig valgt)";
      else t = L.fmtMinor(a.minor, c.currency);
      const extra = [c.vat ? D.VAT_BASIS.find((o) => o.v === c.vat).l.toLowerCase() : "", c.included ? "inngår i budsjettet" : "inngår ikke i budsjettet"].filter(Boolean).join(", ");
      costs.append(h("li", {}, h("b", { text: name + ": " }), t + " · " + extra));
    }
    root.push(costs);
    root.push(h("p", { class: "logic-note", text: "Kostnadene er forutsetninger. De er ikke lagt til budsjettgrensen og er ikke en kalkyle. Ingen treff eller markedstall vises." }));

    summaryEl.replaceChildren(...root);
    const bits = [total + (total === 1 ? " valg" : " valg")];
    if (lim.state === "ok") bits.push(lim.bp === null ? "grense " + L.fmtMinor(lim.limitMinor) : "grense " + L.fmtMinor(lim.limitMinor));
    if (nErr) bits.push(nErr + " feil");
    mobileText.textContent = "Oppsummering · " + bits.join(" · ");
    $("#sheet-close").hidden = !summaryEl.classList.contains("open");
  }

  // ------------------------------------------------------------------ mobil: oppsummering som ark
  const toggle = $("#mobilebar-toggle");
  let sheetReturn = null;
  function setSheet(open) {
    summaryEl.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Lukk oppsummering" : "Vis oppsummering";
    document.body.classList.toggle("sheet-open", open);
    if (open) {
      summaryEl.setAttribute("role", "dialog");
      summaryEl.setAttribute("aria-modal", "true");
      sheetReturn = toggle;
      $("#summary-title").focus();
    } else {
      summaryEl.removeAttribute("role");
      summaryEl.removeAttribute("aria-modal");
      if (sheetReturn) sheetReturn.focus();
    }
    const c = $("#sheet-close");
    if (c) c.hidden = !open;
  }
  toggle.addEventListener("click", () => setSheet(!summaryEl.classList.contains("open")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && summaryEl.classList.contains("open")) setSheet(false);
  });

  // ------------------------------------------------------------------ eksport / import / tøm
  const statusEl = h("div", { class: "status", role: "status", "aria-live": "polite" });
  const importErr = h("div", { class: "import-errors", role: "alert", hidden: true });

  function say(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }
  function showImportErrors(errors) {
    importErr.replaceChildren(h("p", { class: "strong", text: "Importen ble avbrutt. Utkastet ditt er uendret." }), h("ul", {}, errors.slice(0, 12).map((e) => h("li", { text: e }))), errors.length > 12 ? h("p", { text: "… og " + (errors.length - 12) + " til." }) : null);
    importErr.hidden = false;
  }
  function clearImportErrors() { importErr.hidden = true; importErr.replaceChildren(); }

  function doExport() {
    clearImportErrors();
    const r = L.exportDraft(state, new Date());
    if (!r.ok) { say("Eksport stoppet: " + L.errorCount(r.errors) + " felt må rettes først. Se feilmeldingene i skjemaet.", "bad"); return; }
    const text = JSON.stringify(r.draft, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const a = h("a", { href: url, download: "merovo-soekeutkast-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + ".json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    dirty = false;
    say("Utkastet er lastet ned som fil på din maskin. Det er ikke lagret i appens database.", "ok");
  }

  function applyImport(text) {
    const r = L.importDraft(text);
    if (!r.ok) { showImportErrors(r.errors); say("", ""); return; }
    if (L.hasContent(state) && !window.confirm("Importen erstatter utkastet du jobber med nå. Fortsette?")) { say("Importen ble avbrutt. Utkastet er uendret.", ""); return; }
    clearImportErrors();
    state = r.state;
    lastModelChange = null;
    syncAll();
    openAdvancedIfFilled();
    dirty = false;
    say("Utkast importert. Det er ikke lagret i appens database.", "ok");
  }

  function doImportFile(file) {
    clearImportErrors();
    if (!file) return;
    if (file.size > D.LIMITS.importBytes * 2) { showImportErrors(["Filen er for stor."]); return; }
    const reader = new FileReader();
    reader.onerror = () => showImportErrors(["Filen kunne ikke leses."]);
    reader.onload = () => applyImport(String(reader.result));
    reader.readAsText(file);
  }

  function doClear() {
    if (L.hasContent(state) && !window.confirm("Tømme hele utkastet? Eksporter først hvis du vil ta vare på det.")) return;
    state = L.emptyState();
    lastModelChange = null;
    clearImportErrors();
    syncAll();
    dirty = false;
    say("Utkastet er tømt.", "");
  }

  function doExample() {
    if (L.hasContent(state) && !window.confirm("Eksempelet erstatter utkastet du jobber med nå. Fortsette?")) return;
    state = L.exampleState();
    lastModelChange = null;
    clearImportErrors();
    syncAll();
    openAdvancedIfFilled();
    dirty = true;
    say("GLS-eksempelet er fylt ut. Verdiene er demoeksempler, ikke bekreftede ønsker. Ingen søk er sendt.", "ok");
  }

  function openAdvancedIfFilled() {
    for (const d of document.querySelectorAll("details.advanced")) {
      const ids = (d.dataset.fields || "").split(",");
      d.open = ids.some((id) => id && !L.isEmptyValue(L.fieldIndex[id], state.values[id]));
    }
  }

  function buildSaveSection() {
    const fileIn = h("input", { type: "file", accept: ".json,application/json", class: "sr", id: "import-file", tabindex: "-1", "aria-label": "Velg søkeutkast (JSON-fil)" });
    fileIn.addEventListener("change", () => { doImportFile(fileIn.files[0]); fileIn.value = ""; });
    const area = h("textarea", { id: "import-text", rows: "5", "aria-label": "Søkeutkast som JSON-tekst", spellcheck: "false", placeholder: "Lim inn et eksportert søkeutkast (JSON) her" });
    return h("div", { class: "save" },
      h("p", { text: "Utkastet finnes bare i denne nettleserfanen. Det er ikke lagret i appens database, og ingenting sendes. Eksporter en fil for å ta vare på det." }),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "btn btn-primary", id: "btn-export", onclick: doExport }, "Eksporter søkeutkast"),
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-import", onclick: () => fileIn.click() }, "Importer søkeutkast"),
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-clear", onclick: doClear }, "Tøm utkast")),
      fileIn,
      h("details", { class: "paste" }, h("summary", { text: "Lim inn utkast som tekst" }), area,
        h("button", { type: "button", class: "btn btn-secondary", id: "btn-import-text", onclick: () => { clearImportErrors(); applyImport(area.value); } }, "Importer fra tekst")),
      statusEl, importErr);
  }

  // ------------------------------------------------------------------ sidebygging
  function buildField(f) {
    switch (f.kind) {
      case "select": return buildSelect(f);
      case "multi": return buildMulti(f);
      case "radio": return buildRadio(f);
      case "range": return buildRange(f);
      case "regrange": return buildRegRange(f);
      case "max": return buildMax(f);
      case "month": return buildMonth(f);
      case "text": return buildText(f);
      case "colors": return buildColors(f);
      case "towbar": case "equipSelect": return buildPrioSelect(f);
      case "weight": return buildWeight(f);
      case "consumption": return buildConsumption(f);
      case "power": return buildPower(f);
      default: return null;
    }
  }

  function build() {
    const form = $("#form");
    const jump = $("#jump");
    for (const s of sections) {
      const head = h("h2", { id: "sec-" + s.id, tabindex: "-1" }, h("span", { class: "num", text: String(s.n) }), " " + s.title);
      const body = h("div", { class: "grid" });
      if (s.id === "vehicle") {
        body.append(buildVehicleIdentity(s.fields.filter((x) => ["brand", "model", "variant", "packages"].includes(x.id))));
        for (const f of s.fields) if (!["brand", "model", "variant", "packages"].includes(f.id)) body.append(buildField(f));
      } else {
        for (const f of s.fields) body.append(buildField(f));
      }
      const sec = h("section", { class: "card", "aria-labelledby": "sec-" + s.id }, head, body);
      for (const gid of s.equipment || []) {
        const g = D.EQUIPMENT_GROUPS.find((x) => x.id === gid);
        sec.append(buildEquipGroup(g));
      }
      if (s.advanced) {
        const det = h("details", { class: "advanced", "data-fields": s.advanced.fields.map((x) => x.id).join(",") }, h("summary", { text: s.advanced.title }), h("div", { class: "grid" }, s.advanced.fields.map(buildField)));
        sec.append(det);
      }
      form.append(sec);
      jump.append(h("a", { href: "#sec-" + s.id }, s.n + ". " + s.title));
    }
    // 6 Budsjett
    form.append(h("section", { class: "card", "aria-labelledby": "sec-budget" }, h("h2", { id: "sec-budget", tabindex: "-1" }, h("span", { class: "num", text: "6" }), " Innkjøpsbudsjett til Norge"), buildBudget()));
    jump.append(h("a", { href: "#sec-budget" }, "6. Innkjøpsbudsjett"));
    // 7 Oppsummering og lagring
    form.append(h("section", { class: "card", "aria-labelledby": "sec-save" }, h("h2", { id: "sec-save", tabindex: "-1" }, h("span", { class: "num", text: "7" }), " Oppsummering og lagring av søket"), buildSaveSection()));
    jump.append(h("a", { href: "#sec-save" }, "7. Oppsummering og lagring"));
  }

  build();
  $("#btn-example").addEventListener("click", doExample);
  syncAll();
  dirty = false;

  window.addEventListener("beforeunload", (e) => {
    if (dirty && L.hasContent(state)) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  // Ingen nettverkskall, ingen lagring i nettleseren og ingen sporing finnes i denne filen.
})();
