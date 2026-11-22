/* ================= COST PER FOOT & LOST CIRCULATION ================= */
// Mud cost per foot drilled and every lost-circulation event, from the daily mud reports already on the well (nothing typed twice),
// against the offset wells and the mud program's budget: the numbers that show an operator what the mud program saved.
// Kept on the device under cpf_ (per well): cpf_hist (every report, past the 40 the report list keeps), cpf_offsets (offset reports
// added here), cpf_lc (notes and fixes on the events), cpf_plan (the program's budget by interval), cpf_off_* (offsets shown).
const CPF_LCM_DEFAULT = 'LCM, FIBER, FIBRE, CEDAR, WALNUT, NUT PLUG, HULLS, COTTONSEED, MICA, CAL CARB, CALCIUM CARB, MARBLE, GRAPHITE, SEAL, PLUG, 60/40, SAWDUST, MIX II, KWIK, SQUEEZE, BRIDG, FRAC, MAGMA, DIASEAL, FLAKE';
const CPF_NOT_PRODUCT = /\b(RU\/RD|RENTAL|TRUCKING|FEE|ENG\.?|ENGINEER|PALLETS?|SHRINK WRAP|HANDLING)\b/i;   // services on the inventory, never LCM
const CPF_DH = /seep|formation|down ?hole|lost circ|lost returns|squeeze|fractur/i;                         // losses to the hole; the rest are at surface
const cpfMoney = (v, d) => v === null || v === undefined || !isFinite(v) ? '—' : (v < 0 ? '−$' : '$') + fmt(Math.abs(v), d === undefined ? 0 : d);
const cpfK = v => !isFinite(v) ? '—' : Math.abs(v) >= 1e6 ? '$' + fmt(v / 1e6, 2) + 'M' : '$' + fmt(v / 1000, 0) + 'K';
const cpfJ = (k, def) => { try { const v = JSON.parse(store.get(k) || 'null'); return v === null ? def : v; } catch (e) { return def; } };
const cpfInt = s => String(s || '').replace(/^\s*\d+\s*[-–.:)]\s*/, '').trim();   // "2 - Intermediate" → "Intermediate"
function cpfLcmRe() {
  const words = String(rawInput('cpf_lcm', CPF_LCM_DEFAULT)).split(/[,\n]+/).map(s => s.trim()).filter(Boolean).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return words.length ? new RegExp(words.join('|'), 'i') : /(?!)/;
}
// One report, kept small: depth, cost, losses split downhole and surface, every product used with its cost
function cpfSumOf(o) {
  const dh = {}, sf = {}; for (const k in o.losses || {}) { const v = mpNum(o.losses[k]); if (v > 0) (CPF_DH.test(k) ? dh : sf)[k] = v; }
  const prods = (o.inventory || []).filter(p => p && p.name && ((+p.used || 0) > 0 || (+p.cost || 0) > 0)).map(p => [String(p.name), +p.used || 0, +p.cost || 0]);
  const t = mpDate(o.date);
  return { k: o.key, no: o.no === null || o.no === undefined ? '' : String(o.no), date: o.date || '', t, md: mpNum(o.md), int: cpfInt(o.interval), act: o.activity || '', day: mpNum(o.daily), cum: mpNum(o.cum), dh, sf, p: prods, mud: /oil|obm|sbm|synth|invert/i.test(o.mud || '') ? 'OBM' : o.mud ? 'WBM' : '', rem: String(o.remarks || '').slice(0, 400) };
}
const cpfFromMp = r => { const g = r.groups || {}, R = g.Report || {}, C = g.Cost || {}, rep = r.report || {};
  return cpfSumOf({ key: r.key, no: r.no, date: r.date, md: r.md, interval: R.Interval, activity: R.Activity, daily: C['Daily total $'], cum: C['Cum total $'], losses: g['Losses (bbl)'], inventory: rep.inventory, mud: R['Mud type'] || ((r.samples || []).some(s => s['Electrical stability (Volt)'] || s['Oil/water ratio']) ? 'OBM' : ''), remarks: rep.remarks }); };
// Every report of this well: the report list (newest 40) plus the ones it has let go, oldest first
function cpfSync() {
  const reps = mpReports(), hist = cpfJ('cpf_hist', []), by = new Map(hist.map(h => [h.k, h])), now = new Set();
  for (const r of reps) { const s = cpfFromMp(r); now.add(s.k); by.set(s.k, s); }
  let imp = []; try { imp = JSON.parse(rawInput('mp_reports', '[]')) || []; } catch (e) { imp = []; }
  const full = imp.length >= 40, oldest = reps.length ? Math.min(...reps.map(r => r.t || Infinity)) : Infinity;
  for (const [k, h] of by) if (!now.has(k) && !(full && h.t <= oldest)) by.delete(k);   // a report taken off the list goes; one the list let go of stays
  const out = [...by.values()].sort((a, b) => (a.t - b.t) || ((mpNum(a.no) || 0) - (mpNum(b.no) || 0)));
  const s = JSON.stringify(out); if (s !== store.get('cpf_hist')) store.set('cpf_hist', s);
  return out;
}
// Footage, cost per foot and losses for a list of reports (oldest first)
function cpfSeries(list, from) {
  let prev = null, maxMd = from;
  return list.filter(h => h.md !== null || h.cum !== null).map(h => {
    const md = h.md !== null ? h.md : (prev ? prev.md : from), ft = Math.max(0, md - maxMd); maxMd = Math.max(maxMd, md);
    const drilled = maxMd - from, dhT = Object.values(h.dh || {}).reduce((a, v) => a + v, 0), sfT = Object.values(h.sf || {}).reduce((a, v) => a + v, 0);
    const o = Object.assign({}, h, { md, ft, drilled, dhT, sfT, cpfDay: ft > 0 && h.day !== null ? h.day / ft : null, cpfCum: drilled > 0 && h.cum !== null ? h.cum / drilled : null, depthMd: maxMd });
    prev = o; return o;
  });
}
// Mud cost to reach a depth on a well: the cost of the last report at or above it, part way to the next report below it
function cpfCumAt(rows, D) {
  let last = null;
  for (const r of rows) {
    if (r.md === null || r.cum === null) continue;
    if (r.md <= D) { last = r; continue; }
    if (!last) return null;
    return last.cum + (r.cum - last.cum) * (D - last.md) / ((r.md - last.md) || 1);
  }
  return last && last.md >= D - 1 ? last.cum : null;   // the well never got that deep
}
// The offset wells: those built into the tool kit and those added here
function cpfOffsets() {
  const out = [], S = window.SIM_DATA && SIM_DATA.wells ? SIM_DATA.wells.slice(1) : [];
  S.forEach((w, i) => out.push({ id: 'b' + i, name: w.name, src: 'built in', rows: (w.rows || []).map(r => ({ md: r.md, cum: r.cum, day: r.day, date: r.date, no: r.rpt, dh: {}, p: [], noLoss: true })) }));
  for (const w of cpfJ('cpf_offsets', [])) out.push({ id: 'i:' + w.name, name: w.name, src: 'added', rows: w.rows || [] });
  return out.map((w, i) => Object.assign(w, { color: css('--s' + ((i + 1) % 8 + 1)), on: store.get('cpf_off_' + w.id) !== '0' }));
}
// The mud program's budget: "Interval, from ft, to ft, budget $" lines
function cpfPlan() {
  return csvLines(rawInput('cpf_plan', '')).map(p => ({ name: String(p[0] || '').trim(), from: numOr(p[1]), to: numOr(p[2]), cost: numOr(p[3]) })).filter(p => p.from !== null && p.to > p.from && p.cost > 0).sort((a, b) => a.from - b.from);
}
const cpfPlanAt = (plan, D) => { if (!plan.length || D < plan[0].from) return null; let c = 0; for (const p of plan) { if (D >= p.to) c += p.cost; else if (D > p.from) c += p.cost * (D - p.from) / (p.to - p.from); } return D > plan[plan.length - 1].to ? null : c; };
// Lost-circulation events: back-to-back report days with downhole losses, ended once the hole stays full for the set number of reports
function cpfEvents(S, lcmRe) {
  const lim = Math.max(0, V('cpf_lim') || 0), gap = Math.max(1, Math.round(V('cpf_gap') || 1)), ed = cpfJ('cpf_lc', {}), ev = [];
  let cur = null, dry = 0;
  S.forEach((h, i) => {
    const losing = h.dhT > 0 && h.dhT >= lim;
    if (losing) { if (!cur) cur = { i0: i, i1: i, k: h.k }; cur.i1 = i; dry = 0; }
    else if (cur && ++dry >= gap) { cur.cure = i - gap + 1; ev.push(cur); cur = null; dry = 0; }
  });
  if (cur) ev.push(cur);
  for (let j = 0; j < ev.length - 1; j++) if ((ed[ev[j].k] || {}).join) { ev[j].i1 = ev[j + 1].i1; ev[j].cure = ev[j + 1].cure; ev.splice(j + 1, 1); j--; }   // joined by hand
  const mudBbl = h => h.mud === 'OBM' ? V('cpf_obm') : V('cpf_wbm');
  return ev.map((e, n) => {
    const days = S.slice(e.i0, e.i1 + 1), thru = S.slice(e.i0, (e.cure !== undefined ? e.cure : e.i1) + 1), first = S[e.i0], prevMd = e.i0 > 0 ? S[e.i0 - 1].md : first.md;
    const bbl = days.reduce((a, h) => a + h.dhT, 0), types = {}; days.forEach(h => { for (const k in h.dh) types[k] = (types[k] || 0) + h.dh[k]; });
    const lcm = {}; thru.forEach(h => (h.p || []).forEach(([nm, u, c]) => { if (lcmRe.test(nm) && !CPF_NOT_PRODUCT.test(nm)) { const x = lcm[nm] || (lcm[nm] = { used: 0, cost: 0 }); x.used += u; x.cost += c; } }));
    const lcmCost = Object.values(lcm).reduce((a, x) => a + x.cost, 0), mudVal = days.reduce((a, h) => a + h.dhT * (mudBbl(h) || 0), 0), E = ed[e.k] || {};
    const cured = e.cure !== undefined ? S[e.cure] : null, cureDays = cured ? Math.max(1, Math.round((cured.t - first.t) / 864e5) || (e.cure - e.i0)) : null;
    return { n: n + 1, k: e.k, first, last: S[e.i1], cured, cureDays, mdFrom: Math.min(prevMd, first.md), mdTo: S[e.i1].md, bbl, peak: Math.max(...days.map(h => h.dhT)), types, lcm, lcmCost, mudVal,
      ft: days.reduce((a, h) => a + h.ft, 0), int: first.int, not: !!E.not, note: E.note || '', cause: E.cause || '', joined: !!E.join, reports: days.length };
  });
}

init.cpf = function () {
  buildInputs('cpf', [
    { title: 'Compare with', fields: [
      { id: 'cpf_cmp', label: 'Savings against', value: 'avg', options: [['avg', 'The offsets’ average'], ['best', 'The cheapest offset'], ['plan', 'The mud program’s budget']] },
      { id: 'cpf_from', label: 'Footage counted from', unit: 'ft', value: 0, hint: 'Depth the first foot is counted from: 0 for surface, or the conductor depth. Cost per foot is mud cost over the feet drilled below it.' },
      { id: 'cpf_minft', label: 'Plot cost per foot after', unit: 'ft', value: 1500, hint: 'Feet drilled before the cost-per-foot line starts, so spud day doesn’t swamp the scale.' }] },
    { title: 'Lost circulation', fields: [
      { id: 'cpf_lim', label: 'A loss day starts at', unit: 'bbl', value: 10, hint: 'Downhole losses (seepage, formation) on a report at or above this start or continue an event.' },
      { id: 'cpf_gap', label: 'Cured after', unit: 'reports', value: 1, hint: 'Reports in a row with no downhole losses before an event counts as cured. 2 joins events split by one quiet day.' },
      { id: 'cpf_obm', label: 'Value of OBM lost', unit: '$/bbl', value: 0, hint: 'Puts a price on the mud lost. 0 leaves it out.' },
      { id: 'cpf_wbm', label: 'Value of WBM lost', unit: '$/bbl', value: 0 },
      { id: 'cpf_lcm', label: 'LCM: words in the product name', text: 'area', rows: 4, wide: true, value: CPF_LCM_DEFAULT, keep: true, hint: 'A product whose name holds any of these counts as LCM. Rentals, trucking and fees never do.' }] },
    { title: 'Mud program budget', fields: [
      { id: 'cpf_plan', label: 'Interval, from ft, to ft, budget $: one per line', text: 'area', rows: 5, wide: true, value: '', placeholder: 'Surface, 113, 1530, 14741\nIntermediate, 1530, 12669, 145483\nProduction, 12669, 29821, 406754', keep: true, noReport: true }] }
  ], updCpf);
  const host = $('in-cpf');
  // the program's budget read from the program itself
  const pg = el('div', { class: 'grp' }); pg.appendChild(el('p', { class: 'muted', style: 'font-size:12px;margin:0 0 6px' }, 'Or read the budget from the mud program (PDF or Excel). The intervals and their cost go in the box above to check.'));
  const pIn = el('input', { type: 'file', accept: '.pdf,.xlsx,.xlsm,.xls,.docx,.csv,.txt', hidden: '' }); pIn.addEventListener('change', async () => { const f = pIn.files[0]; pIn.value = ''; if (f) await cpfReadProgram(f); });
  pg.append(btnEl('Read budget from mud program…', '', () => pIn.click(), 'upload'), pIn); host.appendChild(pg);
  // the offsets
  const og = el('div', { class: 'grp' }); og.appendChild(el('h2', {}, 'Offset wells')); og.appendChild(el('div', { id: 'cpf-offs', class: 'legend', style: 'flex-direction:column;align-items:flex-start;gap:6px' }));
  const oIn = el('input', { type: 'file', multiple: '', accept: '.pdf,.xlsx,.xlsm,.xls', hidden: '' }); oIn.addEventListener('change', async () => { const fs = [...oIn.files]; oIn.value = ''; if (fs.length) await cpfAddOffsets(fs); });
  og.append(el('p', { class: 'muted', style: 'font-size:12px;margin:8px 0 6px' }, 'Add an offset’s daily mud reports (pick them all at once). They’re read like this well’s and kept as an offset, not as this well’s reports.'), btnEl('Add offset reports…', '', () => oIn.click(), 'upload'), oIn, el('div', { id: 'cpf-offmsg', class: 'muted', style: 'font-size:12px;margin-top:6px' }));
  host.appendChild(og);
  updCpf();
};
function cpfOffsetList(offs) {
  const host = $('cpf-offs'); if (!host) return; host.textContent = '';
  if (!offs.length) { host.appendChild(el('span', { class: 'muted' }, 'None yet.')); return; }
  for (const w of offs) {
    const lab = el('label'), cb = el('input', { type: 'checkbox' }); cb.checked = w.on; cb.addEventListener('change', () => { store.set('cpf_off_' + w.id, cb.checked ? '1' : '0'); updCpf(); });
    const key = el('span', { class: 'key' }); key.style.background = w.color;
    lab.append(cb, key, document.createTextNode(w.name + ' (' + w.rows.length + ' reports' + (w.src === 'added' ? ', added' : '') + ')'));
    if (w.src === 'added') { const x = el('button', { type: 'button', class: 'btn', style: 'padding:0 6px;margin-left:6px;min-height:0;font-size:12px' }, 'Remove'); x.addEventListener('click', e => { e.preventDefault(); store.set('cpf_offsets', JSON.stringify(cpfJ('cpf_offsets', []).filter(o => 'i:' + o.name !== w.id))); store.del('cpf_off_' + w.id); updCpf(); }); lab.appendChild(x); }
    host.appendChild(lab);
  }
}
// Offset reports: each file read like a daily report, grouped into wells by the well name on the report
async function cpfAddOffsets(files) {
  const msg = $('cpf-offmsg'), list = cpfJ('cpf_offsets', []), byName = new Map(list.map(w => [w.name, w])), bad = []; let n = 0;
  for (const [i, f] of files.entries()) {
    msg.textContent = 'Reading ' + (i + 1) + ' of ' + files.length + ': ' + f.name + '…';
    try {
      const o = await MudImport.readAny(f); if (!o.rows) { bad.push(f.name); continue; }
      const d = MudImport.readAll(o.rows, f.name), w = d.well || {}, R = d.report;
      if (!R || !(w.md > 0 || (R.cost && R.cost.cum))) { bad.push(f.name); continue; }
      const name = String(w.well || f.name.replace(/\.[^.]+$/, '').replace(/[_ ]*(dmr|daily|report|mud).*$/i, '') || 'Offset').trim();
      const s = cpfSumOf({ key: (isoDate(w.reportDate || '') || w.reportDate || '') + '|' + (w.reportNo || f.name), no: w.reportNo, date: w.reportDate, md: w.md, interval: w.interval, activity: w.activity, daily: (R.cost || {}).daily, cum: (R.cost || {}).cum, losses: R.losses, inventory: R.inventory, mud: w.mudType, remarks: R.remarks });
      const W = byName.get(name) || { name, rows: [] }; W.rows = W.rows.filter(r => r.k !== s.k).concat(s).sort((a, b) => (a.t - b.t) || ((mpNum(a.no) || 0) - (mpNum(b.no) || 0))); byName.set(name, W); n++;
    } catch (e) { bad.push(f.name); }
  }
  store.set('cpf_offsets', JSON.stringify([...byName.values()]));
  msg.textContent = n + ' report' + (n === 1 ? '' : 's') + ' added' + (bad.length ? '. Not a daily mud report: ' + bad.slice(0, 4).join(', ') + (bad.length > 4 ? ' and ' + (bad.length - 4) + ' more' : '') : '') + '.';
  updCpf();
}
// The program's interval budget: the hole sections from the program, and the row of interval costs that adds up to the well total
async function cpfReadProgram(f) {
  try {
    const o = await MudImport.readAny(f); if (!o.rows) throw 0;
    const rows = o.rows.sheets && o.rows.sheets.length ? o.rows.sheets.flat() : o.rows, prog = MudImport.readProgram(o.rows), holes = ((prog && prog.holes) || []).filter(h => h.top !== null && h.bottom > h.top);
    const money = r => (r.join(' ').match(/\$\s?[\d,]+\.\d{2}/g) || []).map(s => +s.replace(/[$,\s]/g, ''));
    let tot = null; for (const r of rows) { const t = r.join(' '); if (/well total/i.test(t) && !/not in|outside|excluded/i.test(t) && money(r).length) tot = Math.max(tot || 0, money(r).pop()); }
    let amts = null, labels = null;
    for (const r of rows) { const m = money(r); if (m.length >= 3 && tot && Math.abs(m[m.length - 1] - tot) < 1 && Math.abs(m.slice(0, -1).reduce((a, v) => a + v, 0) - tot) < 1) { amts = m.slice(0, -1); break; } }
    for (const r of rows) { const u = r.map(c => String(c).trim().toUpperCase()); const i = u.indexOf('TOTAL'); if (/^PRODUCT$/.test(u[0]) && i > 2) { labels = u.slice(u.indexOf('PKG') >= 0 ? u.indexOf('PKG') + 1 : 1, i); break; } }
    const lines = [];
    if (amts && holes.length) {   // each costed column to the hole section whose mud system names it, else the next one down
      const sum = holes.map(() => 0); let at = 0;
      amts.forEach((a, j) => {
        const L = (labels && labels[j]) || '', k = holes.findIndex(h => L && new RegExp('\\b' + L.replace(/[^A-Z0-9 ]/g, '') + '\\b', 'i').test(h.system || ''));
        const idx = k >= 0 ? k : /SURF|SPUD/.test(L) ? 0 : /CURVE|LATERAL|PROD|OBM/.test(L) ? holes.length - 1 : Math.min(at, holes.length - 1);
        sum[idx] += a; at = Math.max(at, idx);
      });
      holes.forEach((h, i) => { if (sum[i] > 0) lines.push([holes.length === 3 ? ['Surface', 'Intermediate', 'Production'][i] : (h.system || h.size + ' in hole'), h.top, h.bottom, sum[i].toFixed(2)].join(', ')); });
    } else if (tot && holes.length) lines.push(['Whole well', holes[0].top, holes[holes.length - 1].bottom, tot.toFixed(2)].join(', '));
    if (!lines.length) { vxToast('No interval budget found in ' + f.name + '. Type it in the box instead.', true); return; }
    setInputValue('cpf_plan', lines.join('\n')); if (!$('cpf_from') || !(V('cpf_from') > 0)) setInputValue('cpf_from', holes[0].top);
    updCpf(); vxToast('Budget read from ' + f.name + ': ' + lines.length + ' interval' + (lines.length === 1 ? '' : 's') + (tot ? ', ' + cpfMoney(tot) + ' in all' : '') + '. Check it in the box.');
  } catch (e) { vxToast('That file couldn’t be read as a mud program.', true); }
}
let CPF_LAST = null;
function updCpf() {
  if (!$('cpf_from')) return;
  const hist = cpfSync(), from = Math.max(0, V('cpf_from') || 0), S = cpfSeries(hist, from), lcmRe = cpfLcmRe(), offs = cpfOffsets(), on = offs.filter(w => w.on), plan = cpfPlan(), cmp = V('cpf_cmp');
  cpfOffsetList(offs);
  const name = jobVal('j_well') || ((mpReports()[0] || {}).report || {}).names && mpReports()[0].report.names.well || 'This well';
  if (!S.length) {
    tiles('tiles-cpf', [{ label: 'Mud cost per foot', value: '—', sub: 'Import the daily mud reports (Import file, above) and the cost, depth and losses show here.' }]);
    for (const id of ['cpf-proof', 'ch-cpf-cost', 'ch-cpf-cum', 'tbl-cpf-int', 'tbl-cpf-lc', 'tbl-cpf-lcm', 'tbl-cpf-day', 'cpf-lc-edit']) { const h = $(id); if (h) h.textContent = ''; }
    $('leg-cpf-cost').textContent = ''; $('leg-cpf-cum').textContent = ''; CPF_LAST = null; return;
  }
  const L = S[S.length - 1], D = L.depthMd, cum = [...S].reverse().find(h => h.cum !== null), cumNow = cum ? cum.cum : 0, drilled = D - from, cpfNow = drilled > 0 ? cumNow / drilled : null;
  const lastDrill = [...S].reverse().find(h => h.ft > 0 && h.day !== null);
  // the offsets at this well's depth
  const at = on.map(w => ({ w, c: cpfCumAt(w.rows, D) })).filter(x => x.c !== null && x.c > 0);
  const avgC = at.length ? at.reduce((a, x) => a + x.c, 0) / at.length : null, best = at.length ? at.reduce((a, x) => x.c < a.c ? x : a) : null, planC = cpfPlanAt(plan, D);
  const refC = cmp === 'plan' ? planC : cmp === 'best' ? (best ? best.c : null) : avgC, refName = cmp === 'plan' ? 'the mud program’s budget' : cmp === 'best' ? (best ? best.w.name + ', the cheapest offset' : 'the cheapest offset') : 'the offsets’ average (' + at.length + ' well' + (at.length === 1 ? '' : 's') + ')';
  const saved = refC !== null ? refC - cumNow : null;
  // lost circulation
  const EV = cpfEvents(S, lcmRe), evOn = EV.filter(e => !e.not), lossBbl = evOn.reduce((a, e) => a + e.bbl, 0), cured = evOn.filter(e => e.cured), avgCure = cured.length ? cured.reduce((a, e) => a + e.cureDays, 0) / cured.length : null;
  const lcmAll = {}; S.forEach(h => (h.p || []).forEach(([nm, u, c]) => { if (lcmRe.test(nm) && !CPF_NOT_PRODUCT.test(nm)) { const x = lcmAll[nm] || (lcmAll[nm] = { used: 0, cost: 0, ev: 0 }); x.used += u; x.cost += c; } }));
  evOn.forEach(e => { for (const nm in e.lcm) if (lcmAll[nm]) lcmAll[nm].ev += e.lcm[nm].cost; });
  const lcmCost = Object.values(lcmAll).reduce((a, x) => a + x.cost, 0), sfAll = S.reduce((a, h) => a + h.sfT, 0), dhAll = S.reduce((a, h) => a + h.dhT, 0);
  const offLoss = on.filter(w => !w.rows.every(r => r.noLoss)).map(w => { const R = cpfSeries(w.rows, from), dh = R.filter(r => r.md <= D).reduce((a, r) => a + r.dhT, 0); return { w, dh, per: D > from ? dh / ((D - from) / 1000) : null }; });
  const status = saved === null ? null : saved >= 0 ? ['good', cpfMoney(saved) + ' under'] : ['warn', cpfMoney(-saved) + ' over'];
  tiles('tiles-cpf', [
    { label: 'Mud cost to date', value: cpfK(cumNow), sub: S.length + ' report' + (S.length === 1 ? '' : 's') + ' · ' + fmt(drilled, 0) + ' ft drilled to ' + fmt(D, 0) + ' ft' },
    { label: 'Mud cost per foot', value: cpfNow !== null ? '$' + fmt(cpfNow, 2) : '—', unit: '/ft', sub: lastDrill ? 'Last drilling day (' + lastDrill.date + '): $' + fmt(lastDrill.cpfDay, 2) + '/ft over ' + fmt(lastDrill.ft, 0) + ' ft' : 'No footage on the reports yet' },
    { label: 'Against ' + (cmp === 'plan' ? 'the budget' : cmp === 'best' ? 'the cheapest offset' : 'the offsets'), value: refC !== null ? '$' + fmt(refC / Math.max(drilled, 1), 2) : '—', unit: refC !== null ? '/ft' : '', sub: refC !== null ? cpfK(refC) + ' to reach ' + fmt(D, 0) + ' ft' : cmp === 'plan' ? 'Add the program’s budget on the left' : 'No offset reached ' + fmt(D, 0) + ' ft', status },
    { label: 'Lost circulation', value: fmt(lossBbl, 0), unit: 'bbl', sub: evOn.length ? evOn.length + ' event' + (evOn.length === 1 ? '' : 's') + (avgCure !== null ? ' · cured in ' + fmt(avgCure, 1) + ' days on average' : '') + (evOn.some(e => !e.cured) ? ' · still losing' : '') : 'No downhole losses on the reports', status: evOn.some(e => !e.cured) ? ['warn', 'Losing now'] : null },
    { label: 'LCM', value: cpfK(lcmCost), sub: fmt(cpfNow && lcmCost ? lcmCost / cumNow * 100 : 0, 1) + '% of the mud cost · ' + cpfK(evOn.reduce((a, e) => a + e.lcmCost, 0)) + ' during losses' }
  ]);
  // the proof, in words
  const proof = $('cpf-proof'); proof.textContent = '';
  proof.appendChild(el('h2', {}, 'What the mud program has saved'));
  const para = (t, cls) => proof.appendChild(el('p', { class: cls || '', style: 'margin:8px 0 0;font-size:14.5px;line-height:1.5' }, t));
  para('Through ' + fmt(D, 0) + ' ft, mud on ' + (name === 'This well' ? 'this well' : name) + ' has cost ' + cpfMoney(cumNow) + (cpfNow !== null ? ', $' + fmt(cpfNow, 2) + ' per foot drilled' : '') + '.');
  if (saved !== null) para((saved >= 0 ? 'That is ' + cpfMoney(saved) + ' (' + fmt(saved / refC * 100, 0) + '%) less than ' : 'That is ' + cpfMoney(-saved) + ' (' + fmt(-saved / refC * 100, 0) + '%) more than ') + refName + ' to the same depth: ' + cpfMoney(refC) + ', $' + fmt(refC / Math.max(drilled, 1), 2) + ' per foot.');
  else para(cmp === 'plan' ? 'Add the mud program’s budget on the left (or read it from the program) to compare against it.' : 'No offset shown here reached ' + fmt(D, 0) + ' ft, so there is nothing to compare at this depth yet.', 'muted');
  if (cmp !== 'plan' && planC !== null) para('Against the mud program’s budget to this depth (' + cpfMoney(planC) + '): ' + (planC - cumNow >= 0 ? cpfMoney(planC - cumNow) + ' under.' : cpfMoney(cumNow - planC) + ' over.'));
  if (cmp === 'plan' && avgC !== null) para('Against the offsets’ average to this depth (' + cpfMoney(avgC) + '): ' + (avgC - cumNow >= 0 ? cpfMoney(avgC - cumNow) + ' less.' : cpfMoney(cumNow - avgC) + ' more.'));
  para(evOn.length ? 'Lost circulation: ' + fmt(lossBbl, 0) + ' bbl downhole in ' + evOn.length + ' event' + (evOn.length === 1 ? '' : 's') + (avgCure !== null ? ', cured in ' + fmt(avgCure, 1) + ' days on average' : '') + ', with ' + cpfMoney(evOn.reduce((a, e) => a + e.lcmCost, 0)) + ' of LCM.' : 'Lost circulation: none to the hole so far' + (sfAll > 0 ? ' (' + fmt(sfAll, 0) + ' bbl left at surface: dumped, centrifuge, cuttings and evaporation).' : '.'));
  const ol = offLoss.filter(x => x.per !== null);
  if (ol.length) { const avgPer = ol.reduce((a, x) => a + x.per, 0) / ol.length, mine = D > from ? dhAll / ((D - from) / 1000) : 0; para('Losses per 1,000 ft drilled: ' + fmt(mine, 1) + ' bbl on this well against ' + fmt(avgPer, 1) + ' bbl on the offsets with loss data (' + ol.map(x => x.w.name).join(', ') + ').'); }
  const acts = el('div', { class: 'btnrow', style: 'margin-top:12px' }); acts.append(btnEl('Operator summary (print or save as PDF)', 'primary', cpfPrint, 'print')); proof.appendChild(acts);
  // charts: cost per foot and cumulative cost, by depth
  const minFt = Math.max(0, V('cpf_minft') || 0), cpfPts = rows => cpfSeries(rows, from).filter(r => r.drilled >= minFt && r.cpfCum !== null).map(r => [r.depthMd, r.cpfCum, r]);
  const series = [{ name, color: css('--s1'), pts: cpfPts(S) }], cumS = [{ name, color: css('--s1'), pts: S.filter(r => r.cum !== null).map(r => [r.depthMd, r.cum, r]) }];
  for (const w of on) { series.push({ name: w.name, color: w.color, pts: cpfPts(w.rows) }); cumS.push({ name: w.name, color: w.color, pts: w.rows.filter(r => r.cum !== null && r.md !== null).map(r => [r.md, r.cum, r]) }); }
  const xMax = Math.max(D, ...on.map(w => Math.max(0, ...w.rows.map(r => r.md || 0))));
  if (on.length > 1) {   // the offsets' average, every 250 ft where at least two offsets reached
    const avg = [], avgCum = [];
    for (let x = Math.ceil((from + minFt) / 250) * 250; x <= xMax; x += 250) { const c = on.map(w => cpfCumAt(w.rows, x)).filter(v => v !== null && v > 0); if (c.length >= 2) { const m = c.reduce((a, v) => a + v, 0) / c.length; avg.push([x, m / (x - from), null]); avgCum.push([x, m, null]); } }
    series.push({ name: 'Offset average', color: css('--ink2'), dash: '6 4', pts: avg }); cumS.push({ name: 'Offset average', color: css('--ink2'), dash: '6 4', pts: avgCum });
  }
  if (plan.length) {
    const pp = [], pc = [], x0 = plan[0].from, x1 = plan[plan.length - 1].to;
    for (let x = x0; x <= x1; x += Math.max(100, Math.round((x1 - x0) / 120))) { const c = cpfPlanAt(plan, x); if (c === null) continue; pc.push([x, c, null]); if (x - from >= minFt) pp.push([x, c / (x - from), null]); }
    series.push({ name: 'Mud program budget', color: css('--warning') || '#c80', dash: '2 4', pts: pp }); cumS.push({ name: 'Mud program budget', color: css('--warning') || '#c80', dash: '2 4', pts: pc });
  }
  const tipX = (s, p) => p[2] && p[2].date ? (p[2].no ? '#' + p[2].no + ' · ' : '') + p[2].date : '';
  legend('leg-cpf-cost', series); legend('leg-cpf-cum', cumS);
  lineChart('ch-cpf-cost', { series, xLabel: 'Measured depth (ft)', yLabel: 'Mud cost per foot ($/ft)', xUnit: 'ft', yFmt: v => '$' + fmt(v, 0), yTip: v => '$' + fmt(v, 2) + '/ft', snapTol: 900, extra: tipX, height: 320, aria: 'Mud cost per foot by depth, this well against the offsets and the budget' });
  lineChart('ch-cpf-cum', { series: cumS, xLabel: 'Measured depth (ft)', yLabel: 'Mud cost to date', xUnit: 'ft', yFmt: v => cpfK(v), yTip: v => cpfMoney(v), snapTol: 900, extra: tipX, height: 320, aria: 'Cumulative mud cost by depth' });
  // by interval
  const ints = []; S.forEach(h => { const nm = h.int || '—'; let I = ints[ints.length - 1]; if (!I || I.name !== nm) { I = { name: nm, rows: [], start: ints.length ? ints[ints.length - 1].end : from }; ints.push(I); } I.rows.push(h); I.end = Math.max(I.end || 0, h.depthMd); });
  const intRows = ints.map(I => {
    const cost = I.rows.reduce((a, h) => a + (h.day || 0), 0), ft = Math.max(0, I.end - I.start), dh = I.rows.reduce((a, h) => a + h.dhT, 0);
    const offc = on.map(w => { const a = cpfCumAt(w.rows, I.start), b = cpfCumAt(w.rows, I.end); return a !== null && b !== null && b >= a ? b - a : null; }).filter(v => v !== null);
    const oc = offc.length ? offc.reduce((a, v) => a + v, 0) / offc.length : null, pa = cpfPlanAt(plan, I.start), pb = cpfPlanAt(plan, I.end), pl = pa !== null && pb !== null ? pb - pa : null;
    return [I.name, fmt(I.start, 0) + '–' + fmt(I.end, 0), fmt(ft, 0), cpfMoney(cost), ft > 0 ? '$' + fmt(cost / ft, 2) : '—', oc !== null && ft > 0 ? '$' + fmt(oc / ft, 2) : '—', pl !== null && ft > 0 ? '$' + fmt(pl / ft, 2) : '—', oc !== null && ft > 0 ? cpfMoney(oc - cost) : '—', fmt(dh, 0)];
  });
  table('tbl-cpf-int', ['Interval', 'Depth (ft)', 'Drilled (ft)', 'Mud cost', '$/ft', 'Offsets $/ft', 'Budget $/ft', 'Saved vs offsets', 'Lost downhole (bbl)'], intRows);
  // the lost circulation events
  table('tbl-cpf-lc', ['#', 'Dates', 'Depth (ft)', 'Interval', 'Lost (bbl)', 'Worst day (bbl)', 'LCM used', 'LCM $', 'Mud lost $', 'Cured', 'Notes'], EV.map(e => [
    String(e.n) + (e.not ? ' (not LC)' : ''), e.first.date + (e.last !== e.first ? ' – ' + e.last.date : ''), fmt(e.mdFrom, 0) + (e.mdTo !== e.mdFrom ? '–' + fmt(e.mdTo, 0) : ''), e.int || '—', fmt(e.bbl, 0) + ' (' + Object.entries(e.types).map(([k, v]) => k.toLowerCase() + ' ' + fmt(v, 0)).join(', ') + ')', fmt(e.peak, 0),
    Object.entries(e.lcm).sort((a, b) => b[1].cost - a[1].cost).map(([k, x]) => k + ' ×' + fmt(x.used, x.used % 1 ? 1 : 0)).join('; ') || 'none on the reports', cpfMoney(e.lcmCost), e.mudVal > 0 ? cpfMoney(e.mudVal) : '—',
    e.cured ? 'in ' + e.cureDays + ' day' + (e.cureDays === 1 ? '' : 's') + ' (' + e.cured.date + ')' : 'still losing', [e.cause, e.note].filter(Boolean).join(': ')]));
  if (!EV.length) { $('tbl-cpf-lc').textContent = ''; $('tbl-cpf-lc').appendChild(el('p', { class: 'muted', style: 'margin:6px 0 0' }, 'No downhole losses on the reports' + (V('cpf_lim') > 0 ? ' at ' + fmt(V('cpf_lim'), 0) + ' bbl or more a day' : '') + '. Surface losses (' + fmt(sfAll, 0) + ' bbl: dumped, centrifuge, cuttings, evaporation) aren’t lost circulation.')); }
  cpfLcEditor(EV);
  // LCM by product
  table('tbl-cpf-lcm', ['Product', 'Used', 'Cost', 'During losses', 'Background'], Object.entries(lcmAll).sort((a, b) => b[1].cost - a[1].cost).map(([k, x]) => [k, fmt(x.used, x.used % 1 ? 1 : 0), cpfMoney(x.cost), cpfMoney(x.ev), cpfMoney(x.cost - x.ev)]).concat(Object.keys(lcmAll).length ? [['Total', '', cpfMoney(lcmCost), cpfMoney(Object.values(lcmAll).reduce((a, x) => a + x.ev, 0)), cpfMoney(lcmCost - Object.values(lcmAll).reduce((a, x) => a + x.ev, 0))]] : []));
  // day by day
  table('tbl-cpf-day', ['Report', 'Date', 'MD (ft)', 'Drilled (ft)', 'Mud cost', '$/ft that day', 'Cost to date', '$/ft to date', 'Downhole loss (bbl)', 'Surface loss (bbl)', 'LCM $'], [...S].reverse().map(h => [h.no ? '#' + h.no : '—', h.date, fmt(h.md, 0), fmt(h.ft, 0), cpfMoney(h.day), h.cpfDay !== null ? '$' + fmt(h.cpfDay, 2) : '—', cpfMoney(h.cum), h.cpfCum !== null ? '$' + fmt(h.cpfCum, 2) : '—', fmt(h.dhT, 0), fmt(h.sfT, 0), cpfMoney((h.p || []).filter(([nm]) => lcmRe.test(nm) && !CPF_NOT_PRODUCT.test(nm)).reduce((a, x) => a + x[2], 0))]));
  notes('notes-cpf', 'How it’s worked out', [
    ['Cost:', 'each daily mud report’s daily and cumulative mud cost, as the report gives it (products, tax, trucking, engineering). Footage is the depth gained since the last report.'],
    ['Offsets:', 'the mud cost each offset had reached at the same depth, part way between its reports. The built-in offsets are the area wells already in the tool kit; add others with their daily reports.'],
    ['Lost circulation:', 'downhole losses on the reports (seepage, formation). Dumped mud, centrifuge, cuttings and evaporation are surface losses and aren’t counted. An event runs from the first report with losses until the hole stays full.'],
    ['LCM:', 'products whose name matches the list on the left. During losses counts the LCM from the first loss report through the report it was cured on.'],
    ['Every report is kept:', 'this page keeps a copy of each report for the whole well, past the 40 the report list holds.']
  ]);
  CPF_LAST = { name, D, from, drilled, cumNow, cpfNow, refC, refName, saved, planC, avgC, at, EV: evOn, lossBbl, avgCure, lcmCost, sfAll, intRows, lcmAll, S, offLoss, cmp };
}
// Fix an event by hand: a note, what it was, join it with the next one, or say it wasn't lost circulation
function cpfLcEditor(EV) {
  const host = $('cpf-lc-edit'); host.textContent = ''; if (!EV.length) return;
  const ed = cpfJ('cpf_lc', {}), row = el('div', { class: 'btnrow', style: 'margin-top:10px' }), pick = el('select', { 'aria-label': 'Event' });
  EV.forEach(e => pick.appendChild(el('option', { value: e.k }, 'Event ' + e.n + ' · ' + e.first.date + ' · ' + fmt(e.bbl, 0) + ' bbl')));
  const cause = el('select', { 'aria-label': 'What it was' }); for (const [v, t] of [['', 'What it was…'], ['Seepage', 'Seepage'], ['Partial losses', 'Partial losses'], ['Total losses', 'Total losses'], ['Induced (ECD / surge)', 'Induced (ECD / surge)'], ['Natural fractures', 'Natural fractures'], ['Depleted zone', 'Depleted zone'], ['Casing / cementing', 'Casing / cementing']]) cause.appendChild(el('option', { value: v }, t));
  const note = el('input', { type: 'text', placeholder: 'Note: what was done, what cured it', style: 'flex:1;min-width:220px' }), join = el('label'), jcb = el('input', { type: 'checkbox' }), notl = el('label'), ncb = el('input', { type: 'checkbox' });
  join.append(jcb, document.createTextNode(' Join with the next event')); notl.append(ncb, document.createTextNode(' Not lost circulation'));
  const load = () => { const E = ed[pick.value] || {}; cause.value = E.cause || ''; note.value = E.note || ''; jcb.checked = !!E.join; ncb.checked = !!E.not; };
  const save = () => { const E = { cause: cause.value, note: note.value.trim(), join: jcb.checked, not: ncb.checked }; for (const k in E) if (!E[k]) delete E[k]; if (Object.keys(E).length) ed[pick.value] = E; else delete ed[pick.value]; store.set('cpf_lc', JSON.stringify(ed)); const keep = pick.value; updCpf(); const p2 = $('cpf-lc-edit').querySelector('select'); if (p2 && [...p2.options].some(o => o.value === keep)) { p2.value = keep; p2.dispatchEvent(new Event('change')); } };
  pick.addEventListener('change', load); cause.addEventListener('change', save); note.addEventListener('change', save); jcb.addEventListener('change', save); ncb.addEventListener('change', save);
  row.append(pick, cause, note, join, notl); host.append(el('p', { class: 'muted', style: 'font-size:12px;margin:10px 0 0' }, 'Fix an event by hand. It’s kept with the well and goes in the operator summary.'), row); load();
}
// The page for the operator: the savings, the two charts, the intervals and the lost circulation, ready to print or save as a PDF
function cpfPrint() {
  const C = CPF_LAST; if (!C) return;
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const svgOf = id => { const s = $(id) && $(id).querySelector('svg'); if (!s) return ''; const c = s.cloneNode(true); c.setAttribute('width', '100%'); c.removeAttribute('height'); c.style.background = '#fff'; return new XMLSerializer().serializeToString(c); };
  const tbl = (head, rows) => '<table><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>';
  const op = jobVal('j_operator'), rig = jobVal('j_rig'), co = jobVal('j_company'), eng = jobVal('j_engineer'), today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const head = [C.name, op, rig].filter(Boolean).join(' · ');
  const big = C.saved !== null ? (C.saved >= 0 ? cpfMoney(C.saved) + ' saved' : cpfMoney(-C.saved) + ' over') : cpfMoney(C.cumNow);
  const sub = C.saved !== null ? 'against ' + C.refName + ' to ' + fmt(C.D, 0) + ' ft' : 'mud cost to ' + fmt(C.D, 0) + ' ft';
  const kpi = [['Mud cost to date', cpfMoney(C.cumNow)], ['Cost per foot', C.cpfNow !== null ? '$' + fmt(C.cpfNow, 2) + '/ft' : '—'], [C.cmp === 'plan' ? 'Budget per foot' : 'Offsets per foot', C.refC !== null ? '$' + fmt(C.refC / Math.max(C.drilled, 1), 2) + '/ft' : '—'], ['Lost downhole', fmt(C.lossBbl, 0) + ' bbl' + (C.EV.length ? ' in ' + C.EV.length + ' event' + (C.EV.length === 1 ? '' : 's') : '')], ['LCM', cpfMoney(C.lcmCost)]];
  const lc = C.EV.map(e => [e.n, e.first.date + (e.last !== e.first ? ' – ' + e.last.date : ''), fmt(e.mdFrom, 0) + (e.mdTo !== e.mdFrom ? '–' + fmt(e.mdTo, 0) : ''), fmt(e.bbl, 0), Object.entries(e.lcm).sort((a, b) => b[1].cost - a[1].cost).slice(0, 4).map(([k]) => k).join('; ') || '—', cpfMoney(e.lcmCost), e.cured ? e.cureDays + ' day' + (e.cureDays === 1 ? '' : 's') : 'still losing', [e.cause, e.note].filter(Boolean).join(': ')]);
  const proof = [...document.querySelectorAll('#cpf-proof p')].map(p => '<p>' + esc(p.textContent) + '</p>').join('');
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(C.name) + ' · mud cost and lost circulation</title><style>' +
    'body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#15181d;margin:28px;background:#fff}h1{font-size:20px;margin:0}h2{font-size:14px;margin:20px 0 6px;border-bottom:1px solid #d9dde3;padding-bottom:4px}' +
    '.muted{color:#5b6370}.hero{display:flex;gap:18px;align-items:baseline;margin:14px 0 4px}.hero b{font-size:30px;color:' + (C.saved !== null && C.saved < 0 ? '#a15c00' : '#137a3c') + '}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}' +
    '.kpis div{border:1px solid #d9dde3;border-radius:8px;padding:6px 8px}.kpis span{display:block;font-size:11px;color:#5b6370}.kpis b{font-size:15px}table{border-collapse:collapse;width:100%;font-size:11.5px}th,td{border-bottom:1px solid #e4e7eb;padding:4px 6px;text-align:right}th:first-child,td:first-child{text-align:left}' +
    'th{background:#f3f5f7;font-weight:600}.charts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.charts svg text{font-family:system-ui,sans-serif}p{margin:4px 0}.foot{margin-top:18px;font-size:10.5px;color:#5b6370}@media print{body{margin:12mm}.noprint{display:none}h2{break-after:avoid}table,.charts{break-inside:avoid}}</style></head><body>' +
    '<div class="noprint" style="margin-bottom:12px"><button onclick="print()">Print or save as PDF</button></div>' +
    '<h1>Mud cost and lost circulation</h1><div class="muted">' + esc(head) + ' · through ' + fmt(C.D, 0) + ' ft MD · ' + esc(today) + '</div>' +
    '<div class="hero"><b>' + esc(big) + '</b><span class="muted">' + esc(sub) + '</span></div>' + proof +
    '<div class="kpis">' + kpi.map(([l, v]) => '<div><span>' + esc(l) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>' +
    '<div class="charts"><div><h2>Mud cost per foot by depth</h2>' + svgOf('ch-cpf-cost') + '</div><div><h2>Mud cost to date by depth</h2>' + svgOf('ch-cpf-cum') + '</div></div>' +
    '<h2>By interval</h2>' + tbl(['Interval', 'Depth (ft)', 'Drilled (ft)', 'Mud cost', '$/ft', 'Offsets $/ft', 'Budget $/ft', 'Saved vs offsets', 'Lost downhole (bbl)'], C.intRows) +
    '<h2>Lost circulation</h2>' + (lc.length ? tbl(['#', 'Dates', 'Depth (ft)', 'Lost (bbl)', 'LCM', 'LCM $', 'Cured in', 'Notes'], lc) : '<p>No losses to the hole so far.</p>') +
    '<div class="foot">From the daily mud reports' + (co ? ' of ' + esc(co) : '') + (eng ? ', ' + esc(eng) : '') + '. Offsets compared at the same measured depth' + (C.at.length ? ' (' + esc(C.at.map(x => x.w.name).join(', ')) + ')' : '') + '. Lost circulation counts downhole losses only (seepage and formation); surface losses are left out.</div></body></html>';
  const w = window.open('', '_blank'); if (!w) { vxToast('The summary window was blocked. Allow pop-ups for the tool kit and try again.', true); return; }
  w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
}
// Wiring: the page list, the daily report (asked for, never in by default: it carries cost), what refreshes it
TAB_INFO.cpf = 'Mud cost per foot and lost circulation, against the offsets and the budget';
TAB_NAMES.cpf = 'Cost per foot & losses';
REPORT_ASK.add('cpf');
KEY_TABLE.cpf = [['tbl-cpf-int', 'Mud cost by interval'], ['tbl-cpf-lc', 'Lost circulation events']];
VC_TABWORDS.cpf = 'cost per foot cost per foot drilled lost circulation losses lcm savings offsets';
{ const mp = KEY_TABS.find(([re]) => re.source === '^mp_reports$'); if (mp && !mp[1].includes('cpf')) mp[1].push('cpf'); KEY_TABS.push([/^cpf_/, ['cpf']]); }
if (JOBS.mud_engineer && !JOBS.mud_engineer.tabs.includes('cpf')) JOBS.mud_engineer.tabs.push('cpf');
['ch-cpf-cost', 'ch-cpf-cum'].forEach(id => ro.observe($(id)));
{ const base = setInputValue; setInputValue = function (id, v) { base(id, v); if (id === 'mp_reports' && current === 'cpf' && SPECS.cpf) { clearTimeout(setInputValue.cpf); setInputValue.cpf = setTimeout(updCpf, 0); } }; }
