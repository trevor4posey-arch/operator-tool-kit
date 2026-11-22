/* ================= TREATMENT SHEET ================= */
// The tour treatment sheet for the floor and the derrickhand, built from a mud report's recommended treatments, its mud check,
// program, circulation and inventory. Any line can be typed over on the sheet (kept for that report); print, email or copy it.
const TS_UNIT = /^(sxs?|sacks?|sks?|gal(?:lons?)?|bbls?|buckets?|cans?|cups?|ea(?:ch)?|pails?|drums?|totes?|lbs?|ppb|stks?|sticks?|tons?)\b/i;
const TS_QU = /(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(sxs?|sacks?|sks?|gal(?:lons?)?|bbls?|buckets?|cans?|cups?|ea(?:ch)?|pails?|drums?|totes?|lbs?|ppb|stks?|sticks?|tons?)\b(\s*\/\s*(?:hr|hour|tour|conn(?:ection)?|min))?/i;
const TS_SECT = /\b(Active|Tourly\s+Treatments?|Tour\s+Treatments?|Treatments?|Sweeps?(?:\s+consisting\s+of)?|Pills?|LCM\s+pills?|Pre-?treat(?:ment)?(?:\s+for\s+[^:]{1,40})?|Connections?|Trips?|Displacement)\s*:/gi;
// Purpose for the products a mud engineer usually names (shortened as they are written on reports)
const TS_PURPOSE = [[/barite|bar\b|hematite/i, 'Weight'], [/lignite|\blig\b|desco|sapp|thin|lignosulf|tannin/i, 'Thinner / filtration'], [/lime/i, 'Alkalinity'], [/caustic|koh/i, 'pH'],
  [/soda\s*ash|bicarb/i, 'Calcium / cement'], [/pac|poly\s*force|starch|hyperdrill|pam|encap|fl\b/i, 'Filtration / encapsulation'], [/soltex|asphalt|gilsonite|black/i, 'Shale stability'],
  [/gel\b|bentonite|zan|xanthan|vis\b|drill\s*vis|suspentone|vg\b|clay/i, 'Viscosity'], [/cal\s*carb|calcarb|marble|bridg/i, 'Bridging'], [/walnut|cedar|mica|fiber|seal|lcm|plug|nut\s*plug|cotton/i, 'LCM'],
  [/dawn|soap|detergent|vfd|lube|lubric|torque/i, 'Lubricant / soap'], [/defoam|alum|stearate|aluminum/i, 'Defoamer'], [/diesel|abo|base\s*oil|\boil\b/i, 'Oil'], [/water|\bh2o\b|fw\b/i, 'Water'],
  [/mul|emuls|maxx\s*force|ow\b|wet/i, 'Emulsion / wetting'], [/calcium\s*chloride|cacl|salt/i, 'Salinity'], [/biocide|bactericide/i, 'Biocide'], [/scaveng|zinc|h2s/i, 'H₂S scavenger']];
const tsPurpose = name => { for (const [re, p] of TS_PURPOSE) if (re.test(name)) return p; return ''; };
const tsNorm = s => String(s || '').replace(/[–—−]/g, '-').replace(/(\d)\s*½/g, '$1.5').replace(/(\d)\s*¼/g, '$1.25').replace(/(\d)\s*¾/g, '$1.75').replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/¾/g, '0.75').replace(/(^|[^\d])\.(\d)/g, '$10.$2').replace(/(\d)\s*\.(\d)/g, '$1.$2').replace(/\s+/g, ' ').trim();
// Split the report's one block of text into targets, per-tour products, per-connection items, sweeps and notes
function tsParse(txt) {
  const out = { targets: [], items: [], conn: [], sweeps: [], notes: [], none: false };
  let t = tsNorm(txt); if (!t) return out;
  if (/^no\s+treatments?\b/i.test(t)) { out.none = true; out.notes.push(t); return out; }
  // the targets: MW, FV, YP and water rate
  const TG = [['MW', /\bMW\s*-?\s*:?\s*(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(ppg)?/i, 'ppg'], ['FV', /\b(?:FV|Vis)\s*-?\s*:?\s*(\d+(?:\s*-\s*\d+)?)\s*(sec(?:\/qt)?)?/i, 'sec/qt'], ['YP', /\bYP\s*-?\s*:?\s*(\d+(?:\s*-\s*\d+)?)/i, ''],
    ['Water', /\b(?:Water|H2O|FW)\s*-?\s*:?\s*(\d+(?:\s*-\s*\d+)?)\s*(gpm)\b/i, 'gpm']];
  for (const [k, re, u] of TG) { const m = t.match(re); if (m) { out.targets.push([k, m[1].replace(/\s*-\s*/, '–'), u]); t = t.replace(m[0], ' '); } }
  t = t.replace(/\s+/g, ' ').trim();
  // sections: what comes before the first heading is the active system
  const secs = []; let last = 0, name = 'Active'; TS_SECT.lastIndex = 0; let mm;
  while ((mm = TS_SECT.exec(t))) { secs.push([name, t.slice(last, mm.index)]); name = mm[1]; last = mm.index + mm[0].length; }
  secs.push([name, t.slice(last)]);
  for (const [sec, body] of secs) {
    const sweep = /sweep|pill/i.test(sec), pre = /pre-?treat/i.test(sec), conn = /connection/i.test(sec);
    // pieces: after a ")" , after "connection", and after a quantity whose product came before it
    const chunks = [];
    for (const a of body.split(/(?<=\))\s+/)) for (const b of a.split(/(?<=\bconnections?\b)\s+/i)) {
      let s = b.trim();
      while (s) {
        const re = new RegExp(TS_QU.source, 'gi'); let m, cut = -1;
        while ((m = re.exec(s))) {
          const before = s.slice(0, m.index);
          if (!/[a-z]/i.test(before)) {   // amount first ("100 gal VFD-648"): when another product with its own amount follows, its name is the last word before that amount
            const m2 = new RegExp(TS_QU.source, 'i').exec(s.slice(m.index + m[0].length)), mid = m2 ? s.slice(m.index + m[0].length, m.index + m[0].length + m2.index).trim() : '';
            const w = mid.split(' '); if (m2 && w.length >= 2 && /^[A-Z]/.test(w[w.length - 1])) { cut = s.indexOf(mid, m.index + m[0].length) + w.slice(0, -1).join(' ').length; break; }
            continue;
          }
          if (!/^\s*\(/.test(s.slice(m.index + m[0].length)) && !/\(\s*$/.test(before)) { cut = m.index + m[0].length; break; }
        }
        if (cut < 0 || cut >= s.length - 1) { chunks.push(s); break; }
        chunks.push(s.slice(0, cut).trim()); s = s.slice(cut).trim();
      }
    }
    let label = '';
    for (let c of chunks) {
      c = c.replace(/^[\s,;.\-]+|[\s,;]+$/g, ''); if (!c) continue;
      if (sweep) { const lm = c.match(/^(\d{3,5}'?\s*-\s*(?:\d{3,5}'?|first\s+trip|td|[a-z]+\s+trip|[a-z]+))\s+/i); if (lm) { label = lm[1]; c = c.slice(lm[0].length); } }
      const q = c.match(TS_QU), paren = (c.match(/\(([^)]*)\)/) || [])[1] || '';
      const perConn = /\bconn(?:ection)?s?\b/i.test(c), perOther = /every\s+other/i.test(c);
      let item = null;
      if (q) {
        const before = c.slice(0, q.index).replace(/[\s:\-]+$/, '').trim(), after = c.slice(q.index + q[0].length).replace(/\([^)]*\)/g, '').trim();
        let product = /[a-z]/i.test(before) ? before.replace(/\s*\($/, '') : after.replace(/^[\s:\-]+/, '');
        if (/\.\s/.test(product)) product = product.split(/\.\s+/).pop();   // the end of a sentence before it
        product = product.replace(/\s+(every\s+other|per|each|down)\b.*$/i, '').replace(/[\s:\-]+$/, '').trim();
        const unit = q[2].toLowerCase().replace(/^(sxs|sacks?|sks?)$/, 'sx').replace(/^(gallons?)$/, 'gal').replace(/^bbls$/, 'bbl').replace(/^(each)$/, 'ea').replace(/s$/, '').replace(/^ga$/, 'gal');
        const per = q[3] ? q[3].replace(/[\s\/]/g, '').replace(/hour/i, 'hr').toLowerCase() : /\btour\b/i.test(paren) ? 'tour' : /\btotal\b/i.test(paren) ? 'total' : perConn ? (perOther ? 'every other conn.' : 'connection') : /\/\s*min|gal\/min/i.test(c) ? 'min' : '';
        if (product.length > 45) { out.notes.push(c); continue; }
        item = { product: product || c, amt: q[1].replace(/\s*-\s*/, '–'), unit, per, note: paren && !/^(tour|total)$/i.test(paren.trim()) && !paren.includes(q[1]) ? paren.trim() : '', label };
      } else {
        const cm = c.match(/^(\d+(?:\.\d+)?)\s*-?\s*([a-z][a-z0-9 \/.&+-]*?)\s+(?:stick\s+)?(every\s+other|per|each|every)\s+conn/i);
        if (cm) item = { product: cm[2].trim(), amt: cm[1], unit: /stick/i.test(c) ? 'stick' : 'ea', per: /every\s+other/i.test(cm[3]) ? 'every other conn.' : 'connection', note: '', label };
        else { const rm = c.match(/^([a-z][a-z0-9 \/.&+-]*?)\s*\(\s*(\d+(?:\.\d+)?)\s*(gal|bbl)\s*\/\s*(min|hr)\s*\)/i); if (rm) item = { product: rm[1].trim(), amt: rm[2], unit: rm[3].toLowerCase(), per: rm[4].toLowerCase(), note: '', label }; }
      }
      if (!item) { if (c.length > 2) out.notes.push(c); continue; }
      item.purpose = tsPurpose(item.product);
      if (sweep) out.sweeps.push(item); else if (pre) { item.note = item.note || 'pre-treat'; out.items.push(item); } else if (item.per === 'connection' || item.per === 'every other conn.' || conn) out.conn.push(item); else out.items.push(item);
    }
  }
  return out;
}
// The inventory line a product means ("Lig" → LIGNITE, 50#; "CalCarb" → CAL CARB M, 50#)
function tsInv(product, inv) {
  const pn = String(product || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), pw = String(product || '').toUpperCase().split(/[^A-Z0-9]+/).filter(w => w.length >= 3);
  if (pn.length < 3 || !inv || !inv.length) return null;
  let best = null, bs = 0;
  for (const o of inv) {
    const base = String(o.name || '').split(',')[0].toUpperCase(), bn = base.replace(/[^A-Z0-9]/g, ''), bw = base.split(/[^A-Z0-9]+/).filter(Boolean);
    let s = 0;
    if (bn === pn) s = 10; else if (bn.startsWith(pn) || pn.startsWith(bn)) s = 6; else if (pw.length && bw.length && (bw[0].startsWith(pw[0]) || pw[0].startsWith(bw[0]))) s = 3; else if (pw.some(w => bw.includes(w))) s = 2;
    if (/rental|truck|fee|eng\.|engineer|mileage/i.test(o.name)) s = 0;
    if (s > bs) { bs = s; best = o; }
  }
  return bs >= 2 ? best : null;
}
const tsInvUnit = name => { const s = String(name || '').split(',').slice(1).join(',').trim().toUpperCase(); return /TON/.test(s) ? 'ton' : /5\s*GAL/.test(s) ? 'can' : /GAL/.test(s) ? 'gal' : /#|LB/.test(s) ? 'sx' : /EA/.test(s) ? 'ea' : /BBL/.test(s) ? 'bbl' : ''; };
// The report the sheet is for: the one picked, else the newest
function tsReport() { const reps = mpReports(), k = store.get('ts_rep'), i = Math.max(0, reps.findIndex(r => r.key === k)); return { reps, i: reps.length ? i : -1, R: reps[i] || null }; }
function tsEdits(key) { try { const all = JSON.parse(store.get('ts_edits') || '{}') || {}; return all[key] || {}; } catch (e) { return {}; } }
function tsSaveEdit(key, k, v) { let all = {}; try { all = JSON.parse(store.get('ts_edits') || '{}') || {}; } catch (e) { all = {}; } const o = all[key] || (all[key] = {}); if (v === null) delete o[k]; else o[k] = v; const keys = Object.keys(all); if (keys.length > 30) delete all[keys[0]]; store.set('ts_edits', JSON.stringify(all)); }
init.tsht = function () {
  buildInputs('tsht', [
    { title: 'The sheet', fields: [
      { id: 'ts_eng', label: 'Engineers (sign the sheet)', text: true, value: () => jobVal('j_engineer') },
      { id: 'ts_co', label: 'Company line', text: true, value: () => jobVal('j_company'), placeholder: 'Mud company, address, phone' },
      { id: 'ts_rows', label: 'Blank lines to hand-write', unit: '', value: 3, min: 0, max: 10, step: 1 }] },
    { title: 'Send it', fields: [
      { id: 'ts_to', label: 'Email to', text: true, value: '', placeholder: 'company man, toolpusher; separate with commas' },
      { id: 'ts_cc', label: 'Cc', text: true, value: '' }] }
  ], updTsht);
  updTsht();
};
// Everything on the sheet, as data: the screen, the printout, the email and the copied text all read this
function tsData() {
  const { reps, i, R } = tsReport(); if (!R) return null;
  const g = R.groups || {}, rep = g.Report || {}, rr = R.report || {}, prog = g.Program || {}, n = mpNum, ed = tsEdits(R.key);
  const { c } = mpCheckOf(reps, i), w = mpWellOf(R), P = tsParse(rr.treatments || '');
  const inv = rr.inventory || [], names = rr.names || {};
  const well = jobVal('j_well') || names.well || '', rig = jobVal('j_rig') || names.rig || '', op = jobVal('j_operator') || names.operator || '';
  const items = P.items.map(it => { const o = tsInv(it.product, inv); return Object.assign({}, it, { inv: o, onHand: o ? o.final : null, invUnit: o ? tsInvUnit(o.name) : '' }); });
  const range = k => prog[k] || '';
  const checkRows = [['Mud weight', c.mw, 'ppg', range('MW'), 2], ['Funnel viscosity', c.fv, 'sec/qt', range('Vis'), 0], ['PV', c.pv, 'cP', range('PV'), 0], ['YP', c.yp, 'lbf/100ft²', range('YP'), 0],
    ['Gels 10 s / 10 min', c.gel10s !== undefined ? c.gel10s + ' / ' + (c.gel10m !== undefined ? c.gel10m : '—') : undefined, 'lbf/100ft²', '', null], ['API filtrate', c.api, 'ml/30 min', range('FL'), 1],
    ['HTHP filtrate', c.hthp, 'ml/30 min', range('HTHP'), 1], ['pH', c.ph, '', range('pH'), 1], ['Chlorides', c.chlorides, 'mg/L', '', 0], ['Total hardness', c.hardness, 'mg/L', '', 0],
    ['Oil : water', c.owr !== undefined ? c.owr + ' : ' + (100 - c.owr) : undefined, '', '', null], ['Electrical stability', c.es, 'V', range('ES'), 0], ['LGS', w.lgs, '%', range('LGS'), 1], ['Excess lime', c.excessLime, 'lb/bbl', '', 2]]
    .filter(r => r[1] !== undefined && r[1] !== null).map(([lab, v, u, pr, d]) => { const x = typeof v === 'number' ? v : null, rg = mpRange(pr), hiOnly = /filtrate|LGS/i.test(lab), off = x !== null && rg && ((!hiOnly && x < rg[0]) || x > rg[1]); return { lab, val: typeof v === 'number' ? fmt(v, d) : String(v), unit: u, prog: pr, off }; });
  const circ = rr.circ || {}, cr = (k, lab) => circ[k] && (circ[k][0] || circ[k][1]) ? { lab, min: circ[k][0], stk: circ[k][1] } : null;
  const circRows = [cr('surfBit', 'Surface → bit'), cr('btmUp', 'Bottoms-up'), cr('surfSurf', 'Surface → surface'), cr('pits', 'Pits'), cr('total', 'Total circulation')].filter(Boolean);
  const pumps = (rr.pumps || []).filter(p => p.liner || p.spm), shakers = (rr.sce || []).filter(s => /shaker/i.test(s.name) && s.screen).map(s => s.screen);
  const water = P.targets.find(t => t[0] === 'Water'), wr = water ? water[1].split('–').map(Number) : null;
  return { R, key: R.key, ed, no: R.no, date: R.date, md: n(rep['MD (ft)']), tvd: n(rep['TVD (ft)']), activity: rep.Activity || '', interval: rep.Interval || '', formation: rep.Formation || '', mudType: rep['Mud type'] || (fluidOf(R) ? FLUID[fluidOf(R)][0] : ''),
    well, rig, op, eng: V('ts_eng') || jobVal('j_engineer'), co: V('ts_co') || jobVal('j_company'), P, items, checkRows, circRows, pumps, shakers: [...new Set(shakers)], water: wr && wr.every(isFinite) ? wr : null,
    remarks: rr.remarks || '', raw: rr.treatments || '', flowGpm: w.flowGpm || null, used: inv.filter(o => o.used > 0 && !/rental|truck|fee|eng\.|scale|mileage/i.test(o.name)) };
}
// One cell the engineer can type over: the report's value until they do
function tsCell(D, k, v, tag = 'td', cls) {
  const e = el(tag, cls ? { class: cls } : {}), val = D.ed[k] !== undefined ? D.ed[k] : (v === null || v === undefined ? '' : String(v));
  e.textContent = val; e.dataset.k = k; e.contentEditable = acctRO() ? 'false' : 'true'; e.spellcheck = false; if (D.ed[k] !== undefined) e.classList.add('ts-ed');
  return e;
}
const TS_GPM = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50];
function updTsht() {
  const D = tsData(), host = $('ts-sheet'), pick = $('ts-pick'), { reps, R } = tsReport();
  pick.textContent = ''; for (const r of reps.slice(0, 40)) { const o = el('option', { value: r.key }, r.label); if (R && r.key === R.key) o.selected = true; pick.appendChild(o); }
  pick.disabled = !reps.length; ['ts-print', 'ts-mail', 'ts-copy', 'ts-save', 'ts-reset'].forEach(id => { $(id).disabled = !D; });
  host.textContent = ''; $('ts-empty').hidden = !!D; host.hidden = !D; if (!D) return;
  TS_LAST = D;
  const sec = (title, cls) => { const s = el('section', { class: 'ts-sec' + (cls ? ' ' + cls : '') }); s.appendChild(el('h3', {}, title)); host.appendChild(s); return s; };
  // header
  const hd = el('div', { class: 'ts-head' }), l = el('div'), r = el('div', { class: 'ts-title' });
  l.appendChild(tsCell(D, 'co', D.co || '', 'div', 'ts-co')); l.appendChild(el('div', { class: 'ts-sub' }, [D.op, D.rig].filter(Boolean).join(' · ') || ' '));
  r.appendChild(el('div', { class: 'ts-big' }, 'TOUR TREATMENT')); r.appendChild(el('div', { class: 'ts-sub' }, 'Report ' + (D.no ? '#' + D.no : '') + ' · ' + (D.date || '')));
  hd.append(l, r); host.appendChild(hd);
  const info = el('table', { class: 'ts-info' }), irow = (a, av, ak, b, bv, bk) => { const tr = el('tr'); tr.appendChild(el('th', {}, a)); tr.appendChild(tsCell(D, ak, av)); tr.appendChild(el('th', {}, b)); tr.appendChild(tsCell(D, bk, bv)); info.appendChild(tr); };
  irow('Well', D.well, 'well', 'Depth', D.md !== null ? fmt(D.md, 0) + ' ft MD' + (D.tvd ? ' · ' + fmt(D.tvd, 0) + ' TVD' : '') : '', 'depth');
  irow('Interval', [D.interval, D.mudType].filter(Boolean).join(' · '), 'interval', 'Activity', D.activity, 'activity');
  irow('Engineer', D.eng, 'eng', 'Formation', D.formation, 'fm');
  irow('Shaker screens', D.shakers.join(', '), 'screens', 'Pumps', D.pumps.map(p => (p.liner ? p.liner + '″' : '') + (p.spm ? ' @ ' + p.spm + ' spm' : '')).join(' · ') + (D.flowGpm ? ' · ' + fmt(D.flowGpm, 0) + ' gpm' : ''), 'pumps');
  host.appendChild(info);
  // hold these: the treatment's targets, then the last check against the program
  const s1 = sec('Hold these');
  const tg = el('div', { class: 'ts-targets' });
  const pg = (D.R.groups || {}).Program || {}, tgs = D.P.targets.slice();   // what the treatment doesn't name comes from the program
  if (!tgs.some(t => t[0] === 'MW')) tgs.unshift(['MW', pg.MW || '', 'ppg']); if (!tgs.some(t => t[0] === 'FV')) tgs.splice(1, 0, ['FV', pg.Vis || '', 'sec/qt']); if (!tgs.some(t => t[0] === 'Water')) tgs.push(['Water', '', 'gpm']);
  tgs.forEach(([k, v, u], j) => { const b = el('div', { class: 'ts-tg' }); b.appendChild(el('span', {}, k)); const vv = tsCell(D, 'tg' + j, v, 'b'); b.appendChild(vv); if (u) b.appendChild(el('small', {}, u)); tg.appendChild(b); });
  s1.appendChild(tg);
  const ck = el('table', { class: 'ts-tbl' }); ck.appendChild(Object.assign(el('tr'), {})).append(el('th', {}, 'Last check'), el('th', {}, 'Value'), el('th', {}, 'Program'));
  for (const x of D.checkRows) { const tr = el('tr', x.off ? { class: 'ts-off' } : {}); tr.appendChild(el('td', {}, x.lab)); tr.appendChild(el('td', {}, x.val + (x.unit ? ' ' + x.unit : '') + (x.off ? '  ◀ off program' : ''))); tr.appendChild(el('td', {}, x.prog || '')); ck.appendChild(tr); }
  if (D.checkRows.length) s1.appendChild(ck);
  // treatments per tour
  const s2 = sec('Treatments per tour (12 hr)');
  const tt = el('table', { class: 'ts-tbl ts-trt' }); const th = el('tr'); ['Purpose', 'Product', 'Amount', 'Per', 'On hand', 'Note'].forEach(h => th.appendChild(el('th', {}, h))); tt.appendChild(th);
  const rows = D.items.length + Math.max(0, Math.round(V('ts_rows') || 0));
  for (let j = 0; j < rows; j++) {
    const it = D.items[j] || {}, tr = el('tr');
    const oh = it.inv ? fmt(it.onHand, it.onHand % 1 ? 2 : 0) + ' ' + (it.invUnit || '') + (it.amt && it.per === 'tour' && it.onHand > 0 ? ' ≈ ' + fmt(it.onHand / (Math.max(...String(it.amt).split('–').map(Number)) || 1), 0) + ' tours' : '') : (it.product ? 'check on location' : '');
    tr.append(tsCell(D, 'p' + j, it.purpose || ''), tsCell(D, 'n' + j, it.product || ''), tsCell(D, 'a' + j, it.amt ? it.amt + ' ' + it.unit : ''), tsCell(D, 'r' + j, it.per || ''), tsCell(D, 'h' + j, oh), tsCell(D, 'o' + j, it.note || ''));
    tt.appendChild(tr);
  }
  if (!rows) { const tr = el('tr'); const td = el('td', { colspan: 6 }, D.P.none ? 'No treatment at this time.' : 'No per-tour products found in the report’s treatments.'); tr.appendChild(td); tt.appendChild(tr); }
  s2.appendChild(tt);
  if (D.P.conn.length) { const cc = el('ul', { class: 'ts-list' }); D.P.conn.forEach((it, j) => { const li = tsCell(D, 'c' + j, it.amt + ' ' + (it.unit === 'ea' ? '' : it.unit + ' ') + it.product + ' ' + (it.per === 'connection' ? 'per connection' : 'every other connection'), 'li'); cc.appendChild(li); }); s2.appendChild(el('h4', {}, 'Every connection')); s2.appendChild(cc); }
  if (D.P.sweeps.length) {
    s2.appendChild(el('h4', {}, 'Sweeps' + (D.P.sweeps[0].label ? ' (' + D.P.sweeps[0].label + ')' : '')));
    const sw = el('ul', { class: 'ts-list' }); D.P.sweeps.forEach((it, j) => sw.appendChild(tsCell(D, 's' + j, it.product + ' ' + it.amt + ' ' + it.unit + (it.note ? ' (' + it.note + ')' : ''), 'li'))); s2.appendChild(sw);
  }
  const nts = D.P.notes.filter(x => !/^no\s+treatment/i.test(x) || !D.items.length); if (nts.length) { s2.appendChild(el('h4', {}, 'Notes')); const ul = el('ul', { class: 'ts-list' }); nts.forEach((x, j) => ul.appendChild(tsCell(D, 'x' + j, x, 'li'))); s2.appendChild(ul); }
  // next 12 hours: free text for the floor
  const s3 = sec('Next 12 hours'); s3.appendChild(tsCell(D, 'next', D.ed.next !== undefined ? D.ed.next : '', 'div', 'ts-free'));
  // circulation
  if (D.circRows.length) {
    const s4 = sec('Circulation'), ct = el('table', { class: 'ts-tbl ts-circ' }), h1 = el('tr'), r1 = el('tr'), r2 = el('tr'); h1.appendChild(el('th')); r1.appendChild(el('th', {}, 'Minutes')); r2.appendChild(el('th', {}, 'Strokes'));
    for (const x of D.circRows) { h1.appendChild(el('th', {}, x.lab)); r1.appendChild(el('td', {}, fmt(x.min, 0))); r2.appendChild(el('td', {}, fmt(x.stk, 0))); }
    ct.append(h1, r1, r2); s4.appendChild(ct);
  }
  // water rate chart: the gpm the treatment calls for, as a rate the floor can check
  const s5 = sec('Water / dilution rate'), wt = el('table', { class: 'ts-tbl ts-water' }), gpms = TS_GPM.slice();
  if (D.water) for (const x of D.water) if (!gpms.includes(x)) gpms.push(x); gpms.sort((a, b) => a - b);
  const on = x => D.water && x >= D.water[0] && x <= D.water[D.water.length - 1];
  const wrow = (lab, f) => { const tr = el('tr'); tr.appendChild(el('th', {}, lab)); for (const x of gpms) tr.appendChild(el('td', on(x) ? { class: 'ts-on' } : {}, f(x))); wt.appendChild(tr); };
  wrow('gpm', x => String(x)); wrow('bbl / hr', x => fmt(x * 60 / 42, 1)); wrow('bbl / tour', x => fmt(x * 720 / 42, 0)); wrow('sec / 1-qt cup', x => fmt(15 / x, 1)); wrow('sec / 5-gal bucket', x => fmt(300 / x, 0));
  s5.appendChild(el('div', { class: 'scroll' })).appendChild(wt);
  if (D.water) s5.appendChild(el('p', { class: 'ts-note' }, 'Shaded: the ' + D.water.join('–') + ' gpm the treatment calls for.'));
  // remarks and the treatment as written, for reference
  if (D.remarks) { const s6 = sec('Last 24 hours'); s6.appendChild(tsCell(D, 'remarks', D.remarks, 'div', 'ts-free')); }
  // sign-off
  const s7 = sec('Tour sign-off', 'ts-sign'), sg = el('div', { class: 'ts-signs' });
  for (const t of ['Day tour', 'Night tour']) { const b = el('div'); b.appendChild(el('span', {}, t)); b.appendChild(el('div', { class: 'ts-line' })); sg.appendChild(b); }
  s7.appendChild(sg);
  if (D.raw) { const d = el('details', { class: 'ts-raw' }), su = el('summary', {}, 'The treatment as written on the report'); d.append(su, el('p', {}, D.raw)); host.appendChild(d); }
}
let TS_LAST = null;
// The sheet as plain text, for the email body and a text message
function tsText() {
  const D = TS_LAST; if (!D) return '';
  const host = $('ts-sheet'), get = k => { const e = host.querySelector('[data-k="' + k + '"]'); return e ? e.textContent.trim() : ''; }, L = [];
  L.push('TOUR TREATMENT · Report ' + (D.no ? '#' + D.no : '') + ' · ' + (D.date || '')); if (get('co')) L.push(get('co'));
  L.push('Well: ' + get('well') + (get('depth') ? ' · ' + get('depth') : '')); if (get('activity')) L.push('Activity: ' + get('activity')); if (get('interval')) L.push('Interval: ' + get('interval'));
  const tg = [...host.querySelectorAll('.ts-tg')].map(b => [...b.children].map(x => x.textContent.trim()).join(' ').trim()).filter(x => /\d/.test(x)); if (tg.length) L.push('', 'HOLD: ' + tg.join(' · '));
  L.push('', 'TREATMENTS PER TOUR (12 HR)');
  host.querySelectorAll('.ts-trt tr').forEach((tr, j) => { if (!j) return; const c = [...tr.children].map(td => td.textContent.trim()); if (!c[1]) return; L.push('- ' + c[1] + ': ' + c[2] + (c[3] ? ' / ' + c[3] : '') + (c[0] ? ' (' + c[0] + ')' : '') + (c[5] ? ' · ' + c[5] : '') + (c[4] ? ' · on hand ' + c[4] : '')); });
  const list = (h, sel) => { const xs = [...host.querySelectorAll(sel)].map(e => e.textContent.trim()).filter(Boolean); if (xs.length) { L.push('', h); xs.forEach(x => L.push('- ' + x)); } };
  host.querySelectorAll('h4').forEach(h => { const ul = h.nextElementSibling; if (ul && ul.tagName === 'UL') { const xs = [...ul.children].map(e => e.textContent.trim()).filter(Boolean); if (xs.length) { L.push('', h.textContent.toUpperCase()); xs.forEach(x => L.push('- ' + x)); } } });
  if (get('next')) L.push('', 'NEXT 12 HOURS', get('next'));
  if (D.circRows.length) L.push('', 'CIRCULATION: ' + D.circRows.map(x => x.lab + ' ' + fmt(x.min, 0) + ' min / ' + fmt(x.stk, 0) + ' stk').join(' · '));
  if (D.water) L.push('Water ' + D.water.join('–') + ' gpm = ' + D.water.map(x => fmt(x * 60 / 42, 1)).join('–') + ' bbl/hr = ' + D.water.map(x => fmt(300 / x, 0)).join('–') + ' sec per 5-gal bucket');
  const off = D.checkRows.filter(x => x.off); if (off.length) L.push('', 'OFF PROGRAM: ' + off.map(x => x.lab + ' ' + x.val + ' (' + x.prog + ')').join(' · '));
  L.push('', '- ' + (get('eng') || D.eng || 'Mud engineer'));
  return L.join('\n');
}
const tsTitle = () => { const D = TS_LAST; return 'Tour treatment' + (D ? ' · ' + [D.well || '', D.no ? 'Report #' + D.no : '', D.date || ''].filter(Boolean).join(' · ') : ''); };
function tsFile() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), host = $('ts-sheet').cloneNode(true);
  host.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable')); host.querySelectorAll('details').forEach(d => d.remove());
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(tsTitle()) + '</title><style>' + TS_CSS + '</style></head><body>' + host.outerHTML + '</body></html>';
}
const TS_CSS = 'body{font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#000;background:#fff;margin:14px}' +
  '#ts-sheet{max-width:820px;margin:0 auto}.ts-head{display:flex;justify-content:space-between;gap:12px;border-bottom:3px solid #000;padding-bottom:6px;margin-bottom:6px}.ts-co{font-weight:700;font-size:15px}.ts-sub{color:#333;font-size:12px}' +
  '.ts-title{text-align:right}.ts-big{font-size:20px;font-weight:800;letter-spacing:.04em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eee;font-weight:600}' +
  '.ts-info th{width:16%}.ts-sec{margin-top:10px}tr,.ts-targets{break-inside:avoid}h3,h4{break-after:avoid}.ts-sec h3{margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1.5px solid #000}h4{margin:8px 0 2px;font-size:12.5px}' +
  '.ts-targets{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 6px}.ts-tg{border:2px solid #000;border-radius:6px;padding:4px 10px;font-size:15px}.ts-tg span{font-weight:600;margin-right:6px}.ts-tg b{font-size:18px}.ts-tg small{margin-left:4px}' +
  '.ts-off td{background:#fde2e2;font-weight:600}.ts-on{background:#dbe9fb;font-weight:700}.ts-list{margin:2px 0;padding-left:18px}.ts-free{border:1px solid #999;min-height:44px;padding:4px 6px;white-space:pre-wrap}.ts-note{font-size:11.5px;color:#333;margin:3px 0}' +
  '.ts-signs{display:flex;gap:24px}.ts-signs>div{flex:1}.ts-line{border-bottom:1px solid #000;height:28px}.ts-water td,.ts-water th{text-align:center;padding:2px 3px;font-size:11.5px}@page{margin:10mm}';
function tsDownload(name, text, type) {
  if (DL) { DL.save({ filename: name, data: text }).then(r => toast(r && r.status === 'delivered' ? 'Sheet sent.' : 'Sheet saved.'), () => toast('The sheet couldn’t be saved.')); return; }
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/html' })), download: name }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function tsWire() {
  $('ts-pick').addEventListener('change', e => { store.set('ts_rep', e.target.value); updTsht(); });
  // typing over a line keeps it for this report
  $('ts-sheet').addEventListener('input', e => { const c = e.target.closest('[data-k]'); if (!c || !TS_LAST) return; tsSaveEdit(TS_LAST.key, c.dataset.k, c.textContent); c.classList.add('ts-ed'); });
  $('ts-sheet').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest && e.target.closest('td,b,li')) { e.preventDefault(); e.target.blur(); } });
  $('ts-reset').addEventListener('click', () => { if (!TS_LAST) return; let all = {}; try { all = JSON.parse(store.get('ts_edits') || '{}') || {}; } catch (e) { all = {}; } delete all[TS_LAST.key]; store.set('ts_edits', JSON.stringify(all)); updTsht(); $('ts-status').textContent = 'Back to what the report says.'; });
  $('ts-print').addEventListener('click', () => { document.body.classList.add('print-ts'); window.print(); });
  window.addEventListener('afterprint', () => document.body.classList.remove('print-ts'));
  $('ts-mail').addEventListener('click', () => {
    const to = String(V('ts_to') || '').split(/[;,]\s*/).filter(Boolean).join(','), cc = String(V('ts_cc') || '').split(/[;,]\s*/).filter(Boolean).join(',');
    const href = mailHref(to, tsTitle(), tsText()) + (cc ? '&cc=' + encodeURIComponent(cc) : '');
    location.href = href; $('ts-status').textContent = 'Your mail app opens with the sheet in the message. Check it and press Send yourself. To attach it as a page, use Save file first.';
  });
  $('ts-copy').addEventListener('click', async () => {
    const t = tsText();
    try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: tsTitle(), text: t }); return; } await navigator.clipboard.writeText(t); $('ts-status').textContent = 'Copied. Paste it into a text or a message.'; }
    catch (e) { $('ts-status').textContent = 'Copy didn’t work here: select the sheet and copy it by hand.'; }
  });
  $('ts-save').addEventListener('click', () => tsDownload((tsTitle().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Tour treatment') + '.html', tsFile()));
}
