/* ================= BHA VIEWER ================= */
// Every BHA sheet brought in for this well (bit first), the one in the hole, and what it means for volumes, strokes, hydraulics and
// weights, worked out piece by piece. The import bar fills the list (bh_list); "Send to calculators" fills the other tabs from it.
const BH_STEEL = 2.67;     // lb/ft for each in² of steel
const BH_ID_GUESS = 2.5;   // in, for a piece the sheet gives no bore for (flagged)
function bhList() { try { const a = JSON.parse(rawInput('bh_list', '[]')); return Array.isArray(a) ? a.filter(b => b && Array.isArray(b.comps) && b.comps.length) : []; } catch (e) { return []; } }
function bhActive(list) { list = list || bhList(); const id = store.get('bh_active'); return list.find(b => b.id === id) || list[0] || null; }
const bhLen = b => b && b.comps.length ? b.comps[b.comps.length - 1].top : 0;
const bhName = b => (b.no ? 'BHA #' + b.no : 'BHA') + ' · ' + b.comps.length + ' pieces · ' + fmt(bhLen(b), 1) + ' ft' + (b.file ? ' · ' + b.file : '');
// A BHA from the importer, as the list keeps it (the same BHA number and length, or the same file, replaces the copy already there)
function bhRecord(bha, fileName) {
  const comps = bha.components.map(c => ({ n: c.n, sn: c.sn || '', desc: c.desc, od: c.od || null, id: c.id || null, len: c.len, top: c.top, kind: c.kind || 'other', fnOd: c.fnOd || null, wt: c.wt || null }));
  return { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), no: bha.bhaNo || null, file: fileName || '', when: Date.now(), comps, sum: bha.sum || {}, notes: (bha.notes || []).slice(0, 8),
    bit: bha.bitDetails || null, motor: bha.motor || null, stabs: bha.stabs || null, gamma: bha.gammaOffset || null, survey: bha.surveyOffset || null, total: bha.totalLength || null };
}
function bhPairs(bha, fileName) {
  if (!bha || bha.fromReport || !bha.components || bha.components.length < 2) return [];
  const rec = bhRecord(bha, fileName), len = bhLen(rec);
  const list = bhList().filter(x => !(rec.no && x.no === rec.no && Math.abs(bhLen(x) - len) < 0.5) && !(rec.file && x.file === rec.file));
  list.unshift(rec);
  return [['bh_list', JSON.stringify(list.slice(0, 30))], ['bh_active', rec.id]];
}
// What the import fills on the other tabs that this tab also uses: the same numbers here, so the tabs agree
const BH_MIRROR = { h_q: 'bh_q', h_mw: 'bh_mw', h_bitMd: 'bh_bit', h_bitTvd: 'bh_tvd', h_csgId: 'bh_csgId', h_shoeMd: 'bh_shoe', h_wash: 'bh_wash', h_dpOd: 'bh_dpOd', h_dpId: 'bh_dpId',
  h_r600: 'bh_r600', h_r300: 'bh_r300', h_r200: 'bh_r200', h_r100: 'bh_r100', h_r6: 'bh_r6', h_r3: 'bh_r3', h_surf: 'bh_surf', k_bps: 'bh_bps', k_pits: 'bh_pits', b_wt: 'bh_dpWt' };
const bhMirror = pairs => pairs.filter(([id]) => BH_MIRROR[id]).map(([id, v]) => [BH_MIRROR[id], v]);
const bhStored = (id, def) => { const s = store.get(id), v = parseFloat(s); return s !== null && s !== '' && isFinite(v) ? v : def; };
init.bha = function () {
  buildInputs('bha', [
    { title: 'Run it live', fields: [
      { id: 'bh_q', label: 'Flow rate', unit: 'gpm', value: bhStored('h_q', 450), min: 100, max: 900, step: 5, slider: true },
      { id: 'bh_mw', label: 'Mud weight', unit: 'ppg', value: bhStored('h_mw', 10), min: 8.3, max: 16.5, step: 0.05, slider: true },
      { id: 'bh_bit', label: 'Bit depth (MD)', unit: 'ft', value: bhStored('h_bitMd', 10000), hint: 'Where the bit is now. The drill pipe fills the hole from the top of the BHA to surface.' },
      { id: 'bh_tvd', label: 'Bit TVD', unit: 'ft', value: bhStored('h_bitTvd', bhStored('h_bitMd', 10000)) }] },
    { title: 'Hole', fields: [
      { id: 'bh_csgId', label: 'Casing ID', unit: 'in', value: bhStored('h_csgId', 8.835) }, { id: 'bh_shoe', label: 'Shoe MD', unit: 'ft', value: bhStored('h_shoeMd', 5000) },
      { id: 'bh_oh', label: 'Open hole size', unit: 'in', value: 0, hint: '0 uses the BHA’s bit size.' }, { id: 'bh_wash', label: 'Washout (volume)', unit: '%', value: bhStored('h_wash', 0) }] },
    { title: 'Drill pipe above the BHA', fields: [
      { id: 'bh_dpOd', label: 'DP OD', unit: 'in', value: bhStored('h_dpOd', 5) }, { id: 'bh_dpId', label: 'DP ID', unit: 'in', value: bhStored('h_dpId', 4.276) },
      { id: 'bh_dpWt', label: 'DP weight', unit: 'lb/ft', value: bhStored('b_wt', 22.6), hint: 'Adjusted weight with tool joints.' }] },
    { title: 'Pumps & pressure drops', fields: [
      { id: 'bh_bps', label: 'Pump output', unit: 'bbl/stk', value: bhStored('k_bps', 0.1), hint: 'Triplex: 0.000243 × liner² × stroke × efficiency. 6 in × 12 in at 95% = 0.0997.' },
      { id: 'bh_pits', label: 'Surface (active pits)', unit: 'bbl', value: bhStored('k_pits', 500) },
      { id: 'bh_surf', label: 'Surface equipment loss', unit: 'psi', value: bhStored('h_surf', 75) },
      { id: 'bh_motor', label: 'Motor ΔP', unit: 'psi', value: 0, hint: '0 uses the sheet’s motor pressure loss. Add the on-bottom differential here to match the rig’s SPP.' },
      { id: 'bh_tool', label: 'MWD, agitator and other tools ΔP', unit: 'psi', value: 0 },
      { id: 'bh_tfa', label: 'Bit TFA', unit: 'in²', value: 0, hint: '0 uses the sheet’s TFA or nozzles.' }] },
    { title: 'Mud (Fann at test temp)', fields: [
      { id: 'bh_model', label: 'Model', value: 'bingham', options: [['bingham', 'Bingham plastic'], ['hb', 'Herschel-Bulkley (API 13D)']] },
      { id: 'bh_r600', label: 'θ600', value: bhStored('h_r600', 70) }, { id: 'bh_r300', label: 'θ300', value: bhStored('h_r300', 42) }, { id: 'bh_r200', label: 'θ200', value: bhStored('h_r200', 32) },
      { id: 'bh_r100', label: 'θ100', value: bhStored('h_r100', 20) }, { id: 'bh_r6', label: 'θ6', value: bhStored('h_r6', 7) }, { id: 'bh_r3', label: 'θ3', value: bhStored('h_r3', 5) }] }
  ], updBha);
  updBha();
};
// The BHA in the hole: every piece from the bit up, the drill pipe to surface, the annulus split at the shoe
function bhCalc(rec, g, m) {
  const flags = [], q = g.q, gpmBbl = q / 42;
  const bitSize = g.oh > 0 ? g.oh : (rec.sum.bitSize || (rec.comps[0] && rec.comps[0].kind === 'bit' ? rec.comps[0].od : 0) || 8.75);
  const ohEff = bitSize * Math.sqrt(1 + Math.max(0, g.wash) / 100), L = bhLen(rec);
  const parts = rec.comps.map(c => {
    const guess = !(c.id > 0) && c.kind !== 'bit', id = c.id > 0 ? c.id : c.kind === 'bit' ? 0 : BH_ID_GUESS;
    const wt = c.wt > 0 ? c.wt : c.od > 0 ? BH_STEEL * (c.od * c.od - id * id) : 0;
    return Object.assign({}, c, { idUse: id, idGuess: guess, wtFt: wt, from: g.bit - c.top, to: g.bit - c.top + c.len });
  });
  const dpLen = Math.max(0, g.bit - L);
  if (dpLen > 0) parts.push({ n: '', desc: 'Drill pipe to surface', kind: 'dp', od: g.dpOd, id: g.dpId, idUse: g.dpId, len: dpLen, top: g.bit, from: 0, to: dpLen, wtFt: g.dpWt, above: true });
  if (g.bit < L) flags.push(['Bit depth', 'is shallower than the BHA (' + fmt(L, 0) + ' ft): only the part in the hole is counted.']);
  // pieces clipped to the hole
  for (const p of parts) { p.from = Math.max(0, p.from); p.lenIn = Math.max(0, p.to - p.from); }
  const inHole = parts.filter(p => p.lenIn > 0);
  // annulus: each piece against casing above the shoe and open hole below it
  const ann = [];
  for (const p of inHole) {
    if (p.kind === 'bit' || !(p.od > 0)) continue;
    const cut = [[p.from, Math.min(p.to, g.shoe), g.csgId, true], [Math.max(p.from, g.shoe), p.to, ohEff, false]];
    for (const [a, b, D, cased] of cut) {
      if (b - a <= 0.01) continue;
      const area = D * D - p.od * p.od;
      if (area <= 0) { flags.push([p.desc, 'is ' + fmt(p.od, 3) + ' in OD in ' + fmt(D, 3) + ' in ' + (cased ? 'casing' : 'hole') + ': check the OD or the hole size.']); continue; }
      const av = q > 0 ? 24.51 * q / area : 0, gr = annGrad(g.model, m, D, p.od, av);
      ann.push({ p, from: a, to: b, L: b - a, D, od: p.od, cased, area, av, vc: gr.vc, regime: gr.regime, dp: gr.dpdl * (b - a), vol: (b - a) * area / 1029.4 });
    }
  }
  // inside the string: friction for pipe and collars, the motor's own loss, the bit
  let pipeDp = 0, strVol = 0, steel = 0, motorDp = 0;
  const motorSheet = rec.motor && rec.motor.dp > 0 ? rec.motor.dp : (rec.sum && rec.sum.motorDp) || 0;
  for (const p of inHole) {
    if (p.kind === 'bit') continue;
    p.cap = p.idUse * p.idUse / 1029.4; p.disp = p.od > 0 ? (p.od * p.od - p.idUse * p.idUse) / 1029.4 : 0; p.ced = p.od > 0 ? p.od * p.od / 1029.4 : 0;
    strVol += p.cap * p.lenIn; steel += p.disp * p.lenIn;
    if (p.kind === 'motor') { p.dp = g.motor > 0 ? g.motor : motorSheet; motorDp += p.dp; p.v = null; continue; }
    const v = q > 0 && p.idUse > 0 ? 24.51 * q / (p.idUse * p.idUse) : 0, gr = p.idUse > 0 ? pipeGrad(g.model, m, p.idUse, v) : { dpdl: 0, regime: '' };
    p.v = v; p.regime = gr.regime; p.dp = gr.dpdl * p.lenIn; pipeDp += p.dp;
  }
  const guessed = inHole.filter(p => p.idGuess); if (guessed.length) flags.push(['No ID on the sheet', 'for ' + guessed.map(p => p.desc).slice(0, 5).join('; ') + (guessed.length > 5 ? ' and ' + (guessed.length - 5) + ' more' : '') + '. ' + BH_ID_GUESS + ' in is used for volume and pressure loss: type the real bore under Edit pieces.']);
  const hasMotor = inHole.some(p => p.kind === 'motor');
  if (hasMotor && !(g.motor > 0) && !(motorSheet > 0)) flags.push(['Motor ΔP', 'is not on the sheet: type it under Pumps & pressure drops (the no-load loss plus the on-bottom differential) or the standpipe reads low.']);
  if (inHole.some(p => /agitator|oscillat|axe/i.test(p.desc)) && !(g.tool > 0)) flags.push(['Agitator', 'in the string: add its pressure drop (often 400 to 600 psi) under MWD, agitator and other tools.']);
  const tfa = g.tfa > 0 ? g.tfa : rec.sum.tfa || 0, bitDp = tfa > 0 ? m.mw * q * q / (10858 * tfa * tfa) : 0;
  const jet = tfa > 0 ? 0.32086 * q / tfa : 0, hhp = bitDp * q / 1714, hsi = bitSize > 0 ? hhp / (0.7854 * bitSize * bitSize) : 0, impact = 0.000516 * m.mw * q * jet;
  if (!(tfa > 0)) flags.push(['Bit TFA', 'is not on the sheet: type it under Pumps & pressure drops.']);
  const annDp = ann.reduce((a, s) => a + s.dp, 0), annVol = ann.reduce((a, s) => a + s.vol, 0);
  const spp = g.surf + pipeDp + motorDp + g.tool + bitDp + annDp, ecd = m.mw + annDp / (0.052 * Math.max(g.tvd, 1));
  const holeVol = (g.csgId * g.csgId * Math.min(g.shoe, g.bit) + ohEff * ohEff * Math.max(0, g.bit - g.shoe)) / 1029.4;
  const ohAv = ann.filter(s => !s.cased).map(s => s.av), minAvOh = ohAv.length ? Math.min(...ohAv) : null;
  // weights: each piece's own weight (or steel from OD and ID), buoyed by the mud
  const bf = 1 - m.mw / 65.5, bhaParts = inHole.filter(p => !p.above), air = bhaParts.reduce((a, p) => a + p.wtFt * p.lenIn, 0);
  const jar = rec.comps.findIndex(c => c.kind === 'jar'), belowJar = jar > 0 ? bhaParts.filter(p => rec.comps.indexOf(rec.comps.find(c => c.n === p.n && c.top === p.top)) < jar).reduce((a, p) => a + p.wtFt * p.lenIn, 0) : null;
  const strAir = air + (dpLen > 0 ? g.dpWt * dpLen : 0);
  // the motor: bit speed from rev/gal, and the flow range on the sheet
  let motorRpm = null, flowRange = null;
  if (rec.motor) {
    if (rec.motor.revGal > 0) motorRpm = rec.motor.revGal * q;
    const fr = String(rec.motor.flow || '').match(/(\d{2,4})\s*[-–to]+\s*(\d{2,4})/); if (fr) flowRange = [+fr[1], +fr[2]];
    if (flowRange && (q < flowRange[0] || q > flowRange[1])) flags.push(['Flow rate', fmt(q, 0) + ' gpm is outside the motor’s ' + flowRange[0] + '–' + flowRange[1] + ' gpm range.']);
  }
  for (const n of rec.notes || []) flags.push(['From the sheet:', n]);
  const vols = [['Surface to bit (string)', strVol], ['Bottoms-up (annulus)', annVol], ['Surface to surface', strVol + annVol], ['Active pits', g.pits], ['Total circulation', strVol + annVol + g.pits]];
  return { parts, inHole, ann, flags, bitSize, ohEff, tfa, bitDp, jet, hhp, hsi, impact, pipeDp, motorDp, annDp, annVol, strVol, steel, holeVol, spp, ecd, minAvOh, bf, air, belowJar, strAir, motorRpm, flowRange, vols, dpLen, L };
}
function updBha() {
  const list = bhList(), rec = bhActive(list), pick = $('bh-pick'), host = $('bh-draw');
  // the picker: every BHA brought in for this well
  pick.textContent = '';
  for (const b of list) { const o = el('option', { value: b.id }, bhName(b)); if (rec && b.id === rec.id) o.selected = true; pick.appendChild(o); }
  pick.disabled = !list.length; $('bh-send').disabled = !rec; $('bh-del').disabled = !rec; $('bh-edit').hidden = !rec;
  $('bh-empty').hidden = !!rec; $('bh-main').hidden = !rec;
  if (!rec) { tiles('tiles-bha', []); return; }
  const g = { q: V('bh_q'), bit: Math.max(V('bh_bit'), 0), tvd: V('bh_tvd') || V('bh_bit'), csgId: V('bh_csgId'), shoe: V('bh_shoe'), oh: V('bh_oh'), wash: V('bh_wash'), dpOd: V('bh_dpOd'), dpId: V('bh_dpId'), dpWt: V('bh_dpWt'),
    bps: V('bh_bps'), pits: V('bh_pits'), surf: V('bh_surf'), motor: V('bh_motor'), tool: V('bh_tool'), tfa: V('bh_tfa'), model: V('bh_model') };
  const m = mudFrom(V('bh_mw'), V('bh_r600'), V('bh_r300'), V('bh_r200'), V('bh_r100'), V('bh_r6'), V('bh_r3'));
  const r = bhCalc(rec, g, m), q = g.q, stk = v => g.bps > 0 ? v / g.bps : null, min = v => q > 0 ? v / (q / 42) : null, spm = g.bps > 0 && q > 0 ? q / 42 / g.bps : null;
  BH_LAST = { rec, r, g };
  const nz = rec.sum.nozzles && rec.sum.nozzles.length ? rec.sum.nozzles.map(([n, z]) => n + '×' + z).join(', ') : null;
  const flowS = r.flowRange ? (q < r.flowRange[0] || q > r.flowRange[1] ? ['bad', 'Outside ' + r.flowRange[0] + '–' + r.flowRange[1] + ' gpm'] : ['good', 'In the ' + r.flowRange[0] + '–' + r.flowRange[1] + ' gpm range']) : null;
  tiles('tiles-bha', [
    { label: 'BHA', value: fmt(r.L, 1), unit: 'ft', sub: (rec.no ? 'BHA #' + rec.no + ' · ' : '') + rec.comps.length + ' pieces' + (r.dpLen > 0 ? ' · ' + fmt(r.dpLen, 0) + ' ft DP above' : '') },
    { label: 'Bit', value: inch(r.bitSize), sub: 'TFA ' + (r.tfa > 0 ? fmt(r.tfa, 3) + ' in²' : '—') + (nz ? ' · ' + nz : '') },
    { label: 'String volume', value: fmt(r.strVol, 1), unit: 'bbl', sub: g.bps > 0 ? fmt(stk(r.strVol), 0) + ' stk · ' + fmt(min(r.strVol), 0) + ' min to the bit' : 'Type the pump output for strokes' },
    { label: 'Annular volume', value: fmt(r.annVol, 1), unit: 'bbl', sub: g.bps > 0 ? fmt(stk(r.annVol), 0) + ' stk · ' + fmt(min(r.annVol), 0) + ' min bottoms-up' : '' },
    { label: 'Hole volume (no pipe)', value: fmt(r.holeVol, 1), unit: 'bbl', sub: 'Steel displaces ' + fmt(r.steel, 1) + ' bbl' },
    { label: 'Total circulation', value: fmt(r.strVol + r.annVol + g.pits, 0), unit: 'bbl', sub: g.bps > 0 ? fmt(stk(r.strVol + r.annVol + g.pits), 0) + ' stk · ' + fmt(min(r.strVol + r.annVol + g.pits), 0) + ' min' + (spm ? ' at ' + fmt(spm, 0) + ' spm' : '') : 'With ' + fmt(g.pits, 0) + ' bbl in the pits' },
    { label: 'Standpipe (model)', value: fmt(r.spp, 0), unit: 'psi', sub: 'Bit ' + fmt(r.bitDp, 0) + ' psi (' + fmt(r.spp ? r.bitDp / r.spp * 100 : 0, 0) + '%)' + (r.motorDp ? ' · motor ' + fmt(r.motorDp, 0) : '') },
    { label: 'Bit hydraulics', value: fmt(r.hsi, 2), unit: 'HSI', sub: 'Jets ' + fmt(r.jet, 0) + ' ft/s · ' + fmt(r.hhp, 0) + ' HHP · impact ' + fmt(r.impact, 0) + ' lbf' },
    { label: 'ECD at the bit', value: fmt(r.ecd, 2), unit: 'ppg', sub: 'Annulus ' + fmt(r.annDp, 0) + ' psi' + (r.minAvOh !== null ? ' · open-hole AV ' + fmt(r.minAvOh, 0) + ' ft/min' : '') },
    { label: 'BHA weight', value: fmt(r.air * r.bf / 1000, 1), unit: 'klb in mud', sub: fmt(r.air / 1000, 1) + ' klb in air' + (r.belowJar !== null ? ' · below jars ' + fmt(r.belowJar * r.bf / 1000, 1) + ' klb' : '') + ' · string ' + fmt(r.strAir * r.bf / 1000, 0) + ' klb' },
    rec.motor || r.inHole.some(p => p.kind === 'motor') ? { label: 'Motor', value: r.motorRpm ? fmt(r.motorRpm, 0) : '—', unit: r.motorRpm ? 'rpm' : '', sub: (rec.motor && rec.motor.revGal ? rec.motor.revGal + ' rev/gal' : 'No rev/gal on the sheet') + (rec.sum.bend !== null && rec.sum.bend !== undefined ? ' · ' + rec.sum.bend + '° bend' : '') + (rec.sum.b2b ? ' · ' + rec.sum.b2b + ' ft bit to bend' : ''), status: flowS } : null,
    rec.gamma || rec.survey ? { label: 'Sensors behind the bit', value: rec.survey ? fmt(rec.survey, 1) : '—', unit: 'ft survey', sub: (rec.gamma ? 'Gamma ' + fmt(rec.gamma, 1) + ' ft · ' : '') + 'at ' + fmt(g.bit - (rec.survey || rec.gamma), 0) + ' ft MD' } : null
  ].filter(Boolean));
  bhDraw(host, rec, r);
  // the pieces
  table('tbl-bha', ['#', 'Piece', 'Type', 'OD in', 'ID in', 'Length ft', 'Top from bit ft', 'Capacity bbl/ft', 'Displ. bbl/ft', 'Weight lb/ft', 'S/N'],
    r.parts.map(p => [String(p.n), p.desc, BHA_NAME[p.kind] || p.kind, p.od ? fmt(p.od, 3) : '—', p.kind === 'bit' ? '' : (p.idGuess ? fmt(p.idUse, 3) + ' (assumed)' : fmt(p.idUse, 3)), fmt(p.above ? r.dpLen : p.len, 2), p.above ? 'surface' : fmt(p.top, 2),
      p.cap !== undefined ? fmt(p.cap, 5) : '', p.disp !== undefined ? fmt(p.disp, 5) : '', p.wtFt ? fmt(p.wtFt, 1) : '', p.sn || '']));
  // the annulus and the string, section by section, then the bit and surface
  const rows = r.ann.slice().sort((a, b) => a.from - b.from).map(s => [(s.p.above ? 'Drill pipe' : s.p.desc) + (s.cased ? ' × casing' : ' × open hole'), fmt(s.from, 0) + '–' + fmt(s.to, 0), fmt(s.L, 1), fmt(s.D, 3) + ' × ' + fmt(s.od, 3), fmt(s.av, 0), fmt(s.vc, 0), s.regime, fmt(s.dp, 0), fmt(s.vol, 1)]);
  for (const p of r.inHole.filter(p => p.kind !== 'bit').sort((a, b) => a.from - b.from)) rows.push([(p.above ? 'Drill pipe' : p.desc) + ' (inside)', fmt(p.from, 0) + '–' + fmt(p.to, 0), fmt(p.lenIn, 1), 'ID ' + fmt(p.idUse, 3), p.v ? fmt(p.v, 0) : '', '', p.kind === 'motor' ? 'Motor' : p.regime || '', fmt(p.dp || 0, 0), fmt(p.cap * p.lenIn, 1)]);
  rows.push(['Bit (TFA ' + (r.tfa > 0 ? fmt(r.tfa, 3) : '—') + ')', '', '', '', fmt(r.jet * 60, 0), '', 'Jets', fmt(r.bitDp, 0), '']);
  if (g.tool) rows.push(['MWD, agitator and other tools', '', '', '', '', '', '', fmt(g.tool, 0), '']);
  rows.push(['Surface equipment', '', '', '', '', '', '', fmt(g.surf, 0), '']);
  rows.push(['Total (standpipe)', '', '', '', '', '', '', fmt(r.spp, 0), fmt(r.strVol + r.annVol, 1)]);
  table('tbl-bha-hyd', ['Section', 'MD ft', 'Length ft', 'Hole × pipe in', 'Velocity ft/min', 'Crit. vel', 'Flow', 'ΔP psi', 'Volume bbl'], rows);
  table('tbl-bha-vol', ['Path', 'Volume bbl', 'Strokes', 'Minutes'], r.vols.map(([n, v]) => [n, fmt(v, 1), g.bps > 0 ? fmt(stk(v), 0) : '—', q > 0 ? fmt(min(v), 0) : '—']));
  notes('notes-bha', r.flags.length ? 'Check these' : 'Reading it', (r.flags.length ? r.flags : []).concat([
    ['Volumes', 'count each piece at its own OD and ID, the drill pipe from the top of the BHA to surface, and the annulus against the casing above the shoe and open hole below it (washout included).'],
    ['Stabilizers', 'are counted at their body OD: the blades leave the flow-by open, so the annular volume and pressure loss across them read a little low.'],
    ['Send to calculators', 'puts the bit, TFA, nozzles, BHA OD, ID and length, HWDP and drill pipe into Hydraulics & ECD, Well control, Trip sheet, Torque & drag, Buckling and the Calculator, the same as importing the sheet.']
  ]));
  // the editor shows the active BHA's pieces
  const ta = $('bh-comps'); if (ta && document.activeElement !== ta) ta.value = 'Description, OD in, ID in, length ft (bit first)\n' + rec.comps.map(c => [String(c.desc).replace(/,/g, ' '), c.od || '', c.id || '', c.len].join(', ')).join('\n');
}
let BH_LAST = null;
// The BHA drawn to its OD across the hole, the bit at the bottom; long pieces are squeezed, so each piece gets room for its label
function bhDraw(host, rec, r) {
  host.textContent = '';
  const parts = r.parts.filter(p => !p.above), hole = r.bitSize || 8.75;
  const hOf = p => (p.kind === 'dp' || p.kind === 'hwdp') ? 64 : 30 + 50 * Math.sqrt(Math.min(p.len, 90) / 90);
  const W = 640, top = 34, xc = 118, half = 72 / hole;   // 72 px for the hole radius
  let y = top; const ys = [];
  for (let i = parts.length - 1; i >= 0; i--) { const h = hOf(parts[i]); ys[i] = [y, y + h]; y += h; }
  const H = y + 30, svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Drawing of the BHA, bit at the bottom' });
  svg.style.maxWidth = W + 'px'; svg.style.display = 'block';
  const ink = css('--ink'), muted = css('--muted'), axis = css('--axis'), text = (x, yy, s, o = {}) => { const t = sv('text', Object.assign({ x, y: yy, fill: ink, 'font-size': 11.5, 'font-family': css('--font-ui') || 'sans-serif' }, o)); t.textContent = s; svg.appendChild(t); return t; };
  // the hole walls
  for (const sx of [-1, 1]) svg.appendChild(sv('line', { x1: xc + sx * hole / 2 * half, x2: xc + sx * hole / 2 * half, y1: top - 14, y2: H - 18, stroke: axis, 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
  text(xc, top - 18, inch(hole) + ' hole', { 'text-anchor': 'middle', fill: muted, 'font-size': 11 });
  // distance from the bit → y (inside each piece, in proportion)
  const yAt = d => { for (let i = 0; i < parts.length; i++) { const p = parts[i], b = p.top - p.len; if (d >= b - 1e-6 && d <= p.top + 1e-6) { const f = p.len > 0 ? (d - b) / p.len : 0; return ys[i][1] - f * (ys[i][1] - ys[i][0]); } } return d <= 0 ? ys[0][1] : ys[parts.length - 1][0]; };
  parts.forEach((p, i) => {
    const [y0, y1] = ys[i], col = css(BHA_COL[p.kind] || '--ink2') || '#777', w = Math.max(6, (p.od || hole * 0.7) * half);
    if (p.kind === 'bit') {
      const bw = hole * half;
      svg.appendChild(sv('path', { d: 'M' + (xc - bw / 2) + ' ' + y0 + ' H' + (xc + bw / 2) + ' V' + (y1 - 10) + ' Q' + (xc + bw / 2) + ' ' + y1 + ' ' + (xc + bw / 4) + ' ' + y1 + ' H' + (xc - bw / 4) + ' Q' + (xc - bw / 2) + ' ' + y1 + ' ' + (xc - bw / 2) + ' ' + (y1 - 10) + ' Z', fill: col, 'fill-opacity': 0.8, stroke: ink, 'stroke-width': 1 }));
    } else {
      svg.appendChild(sv('rect', { x: xc - w / 2, y: y0, width: w, height: y1 - y0, fill: col, 'fill-opacity': p.kind === 'collar' || p.kind === 'dp' || p.kind === 'hwdp' ? 0.45 : 0.75, stroke: ink, 'stroke-width': 1 }));
      if (p.id > 0) svg.appendChild(sv('rect', { x: xc - p.id * half / 2, y: y0, width: p.id * half, height: y1 - y0, fill: css('--card'), 'fill-opacity': 0.55 }));
      if (p.kind === 'dp' || p.kind === 'hwdp') {   // a break: the pipe is not to scale
        const ym = (y0 + y1) / 2; svg.appendChild(sv('path', { d: 'M' + (xc - w / 2 - 6) + ' ' + (ym - 4) + ' l' + (w + 12) + ' -6 M' + (xc - w / 2 - 6) + ' ' + (ym + 6) + ' l' + (w + 12) + ' -6', stroke: ink, 'stroke-width': 1.2, fill: 'none' }));
      }
    }
    // blades: stabilizers and the motor's pad, to their gauge
    const st = (rec.sum.stabs || []).find(s => s.n === p.n), gauge = st && st.gauge ? st.gauge : p.kind === 'motor' && rec.motor && rec.motor.stabOd > 0 ? rec.motor.stabOd : null;
    if (gauge && gauge > (p.od || 0)) { const gw = gauge * half, yb = p.kind === 'motor' ? y1 - 16 : (y0 + y1) / 2 - 7; svg.appendChild(sv('rect', { x: xc - gw / 2, y: yb, width: gw, height: 14, rx: 3, fill: css('--s3'), 'fill-opacity': 0.9, stroke: ink, 'stroke-width': 1 })); }
    // the motor's bend
    if (p.kind === 'motor' && rec.sum.bend > 0) { const yb = rec.sum.b2b > 0 ? yAt(rec.sum.b2b) : y1 - (y1 - y0) * 0.3; svg.appendChild(sv('path', { d: 'M' + (xc - w / 2 - 8) + ' ' + (yb + 5) + ' L' + (xc + w / 2 + 8) + ' ' + (yb - 5), stroke: css('--s8'), 'stroke-width': 2.5 })); text(xc - w / 2 - 12, yb + 4, rec.sum.bend + '°', { 'text-anchor': 'end', fill: css('--s8'), 'font-weight': 600 }); }
    // the label: number and name, then size, length and how far up from the bit
    const ly = (y0 + y1) / 2, lx = 214;
    svg.appendChild(sv('line', { x1: xc + Math.max(w, gauge ? gauge * half : 0) / 2 + 2, x2: lx - 6, y1: ly, y2: ly, stroke: axis, 'stroke-width': 1 }));
    const nm = String(p.desc); text(lx, ly - 2, (p.n ? p.n + '  ' : '') + (nm.length > 52 ? nm.slice(0, 50) + '…' : nm), { 'font-weight': 600 });
    text(lx, ly + 12, [p.od ? inch(p.od) + (p.id ? ' × ' + inch(p.id) : '') : '', fmt(p.len, 2) + ' ft', 'top ' + fmt(p.top, 1) + ' ft from bit'].filter(Boolean).join('  ·  '), { fill: muted, 'font-size': 11 });
  });
  // gamma and survey sensors
  for (const [lab, d, c] of [['Survey', rec.survey, '--s1'], ['Gamma', rec.gamma, '--s5']]) {
    if (!(d > 0) || d > r.L) continue; const yy = yAt(d), cc = css(c);
    svg.appendChild(sv('line', { x1: xc - hole * half / 2 - 22, x2: xc + hole * half / 2 + 4, y1: yy, y2: yy, stroke: cc, 'stroke-width': 2, 'stroke-dasharray': '3 2' }));
    text(xc - hole * half / 2 - 24, yy + (lab === 'Gamma' ? 12 : -3), lab + ' ' + fmt(d, 1), { 'text-anchor': 'end', fill: cc, 'font-size': 10.5, 'font-weight': 600 });
  }
  text(xc, H - 4, 'Bit at ' + fmt(BH_LAST ? BH_LAST.g.bit : 0, 0) + ' ft MD', { 'text-anchor': 'middle', fill: muted, 'font-size': 11 });
  host.appendChild(svg);
  // the key
  const kinds = [...new Set(parts.map(p => p.kind))], key = el('div', { class: 'legend' });
  for (const k of kinds) { const sp = el('span'), sw = el('span', { class: 'key' }); sw.style.background = css(BHA_COL[k] || '--ink2'); sp.appendChild(sw); sp.appendChild(document.createTextNode(BHA_NAME[k] || k)); key.appendChild(sp); }
  host.appendChild(key);
}
// Fill the other tabs from the BHA in the hole, as importing its sheet does
function bhSend() {
  const rec = bhActive(); if (!rec || acctRO()) return;
  const comps = rec.comps.map(c => Object.assign({}, c)), b = { components: comps, sum: rec.sum, notes: [] };
  const pairs = wellPairs({}, {}, { bha: b }).concat(Calc.importPairs({}, {}, { bha: b }));
  const g = BH_LAST && BH_LAST.rec === rec ? BH_LAST : null;
  if (g) { pairs.push(['h_tfa', g.r.tfa || null]); if (g.r.motorDp || g.g.tool) pairs.push(['h_motor', Math.round(g.r.motorDp + g.g.tool)]); }
  const set = acctTabSet(); let n = 0;
  for (const [id, v] of pairs) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) continue;
    if (set && !tabsOfKey(id).some(t => set.has(t))) continue;
    if (Calc.has(id)) Calc.setInput(id, v); else setInputValue(id, v); n++;
  }
  const s = $('bh-status'); s.textContent = 'Sent: ' + n + ' inputs on Hydraulics & ECD, Well control, Trip sheet, Torque & drag, Buckling and the Calculator now use ' + (rec.no ? 'BHA #' + rec.no : 'this BHA') + '.';
}
// Hand-made changes to the pieces: description, OD, ID and length, bit first
function bhSaveEdit() {
  const list = bhList(), rec = bhActive(list); if (!rec) return;
  const lines = String($('bh-comps').value || '').split(/\r?\n/).map(l => l.split(',').map(x => x.trim())).filter(a => a.length >= 4 && isFinite(parseFloat(a[a.length - 1])) && !/^description/i.test(a[0]));
  const s = $('bh-status'); if (lines.length < 2) { s.textContent = 'Nothing saved: each line needs a description, OD, ID and length, bit first.'; return; }
  let top = 0; const old = rec.comps;
  const comps = lines.map((a, i) => {
    const len = parseFloat(a[a.length - 1]), id = parseFloat(a[a.length - 2]), od = parseFloat(a[a.length - 3]), desc = a.slice(0, a.length - 3).join(' ') || 'Piece'; top += len;
    const was = old.find(c => c.desc === desc) || {};
    const c = { n: i + 1, sn: was.sn || '', desc, od: od > 0 ? od : null, id: id > 0 && (!(od > 0) || id < od) ? id : null, len, top: +top.toFixed(2), fnOd: was.fnOd || null, wt: was.wt || null };
    c.kind = MudImport.bhaKind ? MudImport.bhaKind(c, i) : was.kind || 'other'; return c;
  });
  const b = MudImport.bhaSummary ? MudImport.bhaSummary({ components: comps, notes: [], bitDetails: rec.bit, motor: rec.motor, stabs: rec.stabs, surveyOffset: rec.survey, gammaOffset: rec.gamma }) : { components: comps, sum: rec.sum, notes: [] };
  Object.assign(rec, { comps: b.components.map(c => ({ n: c.n, sn: c.sn, desc: c.desc, od: c.od, id: c.id, len: c.len, top: c.top, kind: c.kind, fnOd: c.fnOd, wt: c.wt })), sum: b.sum, notes: (b.notes || []).filter(x => !/add up to/.test(x)), edited: Date.now() });
  setInputValue('bh_list', JSON.stringify(list)); s.textContent = 'Saved ' + comps.length + ' pieces.'; updBha();
}
function bhWire() {
  $('bh-pick').addEventListener('change', e => { store.set('bh_active', e.target.value); $('bh-status').textContent = ''; updBha(); });
  $('bh-send').addEventListener('click', bhSend);
  $('bh-save').addEventListener('click', bhSaveEdit);
  const del = $('bh-del');
  del.addEventListener('click', () => {
    if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'Tap again to remove'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'Remove'; }, 4000); return; }
    del.dataset.armed = ''; del.textContent = 'Remove';
    const list = bhList(), rec = bhActive(list); if (!rec) return;
    setInputValue('bh_list', JSON.stringify(list.filter(b => b.id !== rec.id))); store.del('bh_active'); $('bh-status').textContent = 'Removed ' + (rec.no ? 'BHA #' + rec.no : 'the BHA') + '.'; updBha();
  });
}
