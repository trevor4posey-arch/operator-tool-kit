"""Splice the BHA viewer and the treatment sheet into Operator Tool Kit.html. Usage: python3 splice.py in.html out.html
Each edit is an exact, unique anchor so it applies on top of other threads' changes; it stops if an anchor is missing."""
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
if 'id="tab-bha"' in s:
    sys.exit('already spliced')

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit('anchor found %d times (want %d): %r' % (n, count, old[:90]))
    s = s.replace(old, new)

# 1 the importer hands the page its BHA summary and piece types
rep("window.MudImport = { mount, readMudpro,", "window.MudImport = { mount, bhaSummary, bhaKind: kindOf, readMudpro,")
# 2 tab buttons
rep('<button role="tab" data-tab="treat" data-group="mud" aria-selected="false">Treatment preview</button>',
    '<button role="tab" data-tab="treat" data-group="mud" aria-selected="false">Treatment preview</button>\n'
    '    <button role="tab" data-tab="tsht" data-group="mud" aria-selected="false">Treatment sheet</button>')
rep('<button role="tab" data-tab="dd" data-group="drl" aria-selected="false" hidden>Directional</button>',
    '<button role="tab" data-tab="dd" data-group="drl" aria-selected="false" hidden>Directional</button>\n'
    '    <button role="tab" data-tab="bha" data-group="drl" aria-selected="false" hidden>BHA</button>')
# 3 the two sections
SECTIONS = '''  <!-- BHA -->
  <section class="tab" id="tab-bha">
    <aside class="panel inputs" id="in-bha"></aside>
    <div>
      <div class="card bh-bar">
        <div class="btnrow"><label for="bh-pick" class="bh-lab">BHA in the hole</label><select id="bh-pick"></select>
          <button class="btn primary" id="bh-send" type="button">Send to calculators</button><button class="btn" id="bh-del" type="button">Remove</button></div>
        <p class="sub" id="bh-status" role="status"></p>
        <p class="sub" id="bh-empty">No BHA yet. Drop the directional company’s BHA sheet (Excel or PDF) on Import file above. Every sheet is kept for this well, and the newest one is put in the hole.</p>
      </div>
      <div id="bh-main">
        <div class="tiles" id="tiles-bha"></div>
        <div class="card"><h2>The BHA</h2><p class="sub">To OD across the hole, bit at the bottom. Long pieces are squeezed so every label fits. Stabilizer blades are green, the motor’s bend red, the sensors dashed.</p><div id="bh-draw" class="bh-draw"></div></div>
        <div class="card"><h2>Volumes and strokes</h2><p class="sub">At the pump output and flow rate on the left.</p><div class="scroll" id="tbl-bha-vol"></div></div>
        <div class="card"><h2>The pieces</h2><p class="sub">Bit first, as on the sheet, then the drill pipe to surface.</p><div class="scroll" id="tbl-bha"></div>
          <details id="bh-edit"><summary>Edit pieces</summary><p class="sub">One piece a line, bit first: description, OD, ID, length. Fix a missing bore or a wrong OD here, then save.</p><textarea id="bh-comps" rows="12" spellcheck="false" aria-label="BHA pieces"></textarea><div class="btnrow"><button class="btn" id="bh-save" type="button">Save pieces</button></div></details></div>
        <div class="card"><h2>Hydraulics piece by piece</h2><p class="sub">The annulus against casing and open hole, inside the string, then the bit and surface.</p><div class="scroll" id="tbl-bha-hyd"></div></div>
        <div class="card notes" id="notes-bha"></div>
      </div>
    </div>
  </section>
  <!-- TREATMENT SHEET -->
  <section class="tab" id="tab-tsht">
    <aside class="panel inputs" id="in-tsht"></aside>
    <div>
      <div class="card ts-bar">
        <div class="btnrow"><label for="ts-pick" class="bh-lab">Mud report</label><select id="ts-pick"></select></div>
        <div class="btnrow"><button class="btn primary" id="ts-print" type="button">Print or save PDF</button><button class="btn" id="ts-mail" type="button">Email</button><button class="btn" id="ts-copy" type="button">Copy text</button><button class="btn" id="ts-save" type="button">Save file</button><button class="btn" id="ts-reset" type="button">Back to the report</button></div>
        <p class="sub" id="ts-status" role="status">Built from the report’s recommended tour treatments, its mud check, program, circulation and inventory. Tap any line on the sheet to change it; your changes stay with that report.</p>
        <p class="sub" id="ts-empty" hidden>No mud report yet. Import the day’s mud report (Excel or PDF) with Import file above and the sheet builds itself.</p>
      </div>
      <div class="card ts-wrap"><div id="ts-sheet"></div></div>
    </div>
  </section>
  <!-- TREATMENT -->'''
rep('  <!-- TREATMENT -->', SECTIONS)
# 4 styles, at the end of the page's main style block
CSS = '''  /* BHA viewer and treatment sheet */
  .bh-lab { font-weight: 600; font-size: 13.5px; }
  #bh-pick, #ts-pick { max-width: 100%; min-width: 0; flex: 1 1 260px; }
  .bh-draw { overflow-x: auto; }
  .bh-draw .legend .key { height: 10px; width: 12px; border-radius: 2px; }
  #bh-comps { width: 100%; font-family: var(--font-num); font-size: 12.5px; }
  #tbl-bha td:nth-child(2), #tbl-bha-hyd td:first-child { font-family: var(--font-ui); text-align: left; white-space: normal; min-width: 190px; }
  .ts-wrap { overflow-x: auto; }
  #ts-sheet { max-width: 880px; font-size: 13.5px; }
  #ts-sheet table { border-collapse: collapse; width: 100%; }
  #ts-sheet th, #ts-sheet td { border: 1px solid var(--axis); padding: 4px 7px; text-align: left; vertical-align: top; font-family: var(--font-ui); white-space: normal; }
  #ts-sheet th { background: var(--surface); font-weight: 600; }
  #ts-sheet .ts-head { display: flex; justify-content: space-between; gap: 12px; border-bottom: 3px solid var(--ink); padding-bottom: 6px; margin-bottom: 8px; }
  #ts-sheet .ts-co { font-weight: 700; font-size: 15px; } #ts-sheet .ts-sub { color: var(--ink2); font-size: 12.5px; }
  #ts-sheet .ts-title { text-align: right; } #ts-sheet .ts-big { font-size: 20px; font-weight: 800; letter-spacing: .04em; }
  #ts-sheet .ts-info th { width: 16%; }
  #ts-sheet .ts-sec { margin-top: 12px; } #ts-sheet .ts-sec h3 { margin: 0 0 5px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid var(--ink); }
  #ts-sheet h4 { margin: 9px 0 3px; font-size: 13px; }
  #ts-sheet .ts-targets { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 8px; }
  #ts-sheet .ts-tg { border: 2px solid var(--ink); border-radius: 8px; padding: 4px 10px; font-size: 15px; } #ts-sheet .ts-tg span { font-weight: 600; margin-right: 6px; } #ts-sheet .ts-tg b { font-size: 18px; } #ts-sheet .ts-tg small { margin-left: 4px; color: var(--ink2); }
  #ts-sheet .ts-off td { background: color-mix(in srgb, var(--critical) 14%, transparent); font-weight: 600; }
  #ts-sheet .ts-on { background: color-mix(in srgb, var(--accent) 18%, transparent); font-weight: 700; }
  #ts-sheet .ts-water th, #ts-sheet .ts-water td { text-align: center; padding: 3px 4px; font-size: 12px; }
  #ts-sheet .ts-list { margin: 2px 0; padding-left: 20px; }
  #ts-sheet .ts-free { border: 1px solid var(--axis); min-height: 48px; padding: 5px 7px; white-space: pre-wrap; }
  #ts-sheet .ts-note { font-size: 12px; color: var(--ink2); margin: 4px 0; }
  #ts-sheet .ts-signs { display: flex; gap: 24px; } #ts-sheet .ts-signs > div { flex: 1; } #ts-sheet .ts-line { border-bottom: 1px solid var(--ink); height: 30px; }
  #ts-sheet [contenteditable="true"]:hover { outline: 1px dashed var(--accent); outline-offset: -1px; cursor: text; }
  #ts-sheet [contenteditable="true"]:focus { outline: 2px solid var(--accent); outline-offset: -1px; background: var(--accent-soft); }
  #ts-sheet .ts-ed { background: color-mix(in srgb, var(--warning) 16%, transparent); }
  #ts-sheet .ts-co:empty::before { content: 'Company line: tap to type'; color: var(--muted); font-weight: 400; }
  #ts-sheet .ts-raw { margin-top: 12px; font-size: 12.5px; color: var(--ink2); }
  @media print {
    body.print-ts header, body.print-ts nav, body.print-ts footer, body.print-ts .tab:not(#tab-tsht), body.print-ts #tab-tsht > aside, body.print-ts .ts-bar,
    body.print-ts #importBar, body.print-ts #installHelp, body.print-ts .page-head, body.print-ts .ts-raw { display: none !important; }
    body.print-ts #tab-tsht { display: block !important; }
    body.print-ts main { padding: 0; max-width: none; }
    body.print-ts .ts-wrap { border: none; box-shadow: none; padding: 0; background: #fff; }
    body.print-ts, body.print-ts #ts-sheet { background: #ffffff; color: #000000; font-size: 12px; }
    body.print-ts #ts-sheet th, body.print-ts #ts-sheet td { border-color: #888; }
    body.print-ts #ts-sheet .ts-ed { background: none; }
    body.print-ts #ts-sheet tr, body.print-ts #ts-sheet .ts-targets, body.print-ts #ts-sheet .ts-signs { break-inside: avoid; } body.print-ts #ts-sheet h3, body.print-ts #ts-sheet h4 { break-after: avoid; }
    body.print-ts #ts-sheet .ts-co:empty::before { content: none; }
    body.print-ts #ts-sheet .ts-on, body.print-ts #ts-sheet .ts-off td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>'''
rep('</style>\n</head>', CSS + '\n</head>')
# 5 the code: before the roles section
JS = open(os.path.join(here, 'bha.js'), encoding='utf-8').read() + '\n' + open(os.path.join(here, 'tsht.js'), encoding='utf-8').read() + '\nbhWire(); tsWire();\n\n'
rep('/* ================= YOUR ROLE: the tool kit set up for each job ================= */', JS + '/* ================= YOUR ROLE: the tool kit set up for each job ================= */')
# 6 an import or a change to the list redraws the open tab
rep("  if ((id === 'mp_reports' || id === 'mp_want') && current === 'mprop') { clearTimeout(setInputValue.mp); setInputValue.mp = setTimeout(updMprop, 0); }   // an imported mud report shows at once\n",
    "  if ((id === 'mp_reports' || id === 'mp_want') && current === 'mprop') { clearTimeout(setInputValue.mp); setInputValue.mp = setTimeout(updMprop, 0); }   // an imported mud report shows at once\n"
    "  if (id === 'bh_list' && current === 'bha' && SPECS.bha) { clearTimeout(setInputValue.bh); setInputValue.bh = setTimeout(updBha, 0); }   // a BHA sheet shows at once\n"
    "  if (id === 'mp_reports' && current === 'tsht' && SPECS.tsht) { clearTimeout(setInputValue.ts); setInputValue.ts = setTimeout(updTsht, 0); }   // so does a new mud report on the treatment sheet\n")
# 7 an import keeps BHA sheets in the list and mirrors the well onto the BHA tab
rep("    if (d.geo && !(d.surveys && rawInput('ac_imp', 'this') === 'offset')) pairs.push(['w_geo', geoKeep(d.geo, d), 'The well’s location']);",
    "    if (!older) pairs = pairs.concat(bhMirror(pairs), d.bha ? bhPairs(d.bha, d.fileName) : []);   // the BHA tab: the same well numbers, and the sheet added to the well’s BHAs\n"
    "    if (d.geo && !(d.surveys && rawInput('ac_imp', 'this') === 'offset')) pairs.push(['w_geo', geoKeep(d.geo, d), 'The well’s location']);")
rep("i === 0 ? mpDepthPairs(reps) : []), set = acctTabSet(); let n = 0;",
    "i === 0 ? mpDepthPairs(reps) : []), set = acctTabSet(); let n = 0;\n  pairs.push(...bhMirror(pairs));   // the BHA tab follows the report too")
# 8 registries
rep("const KEY_TABS = [[/^mp_reports$/, ['mprop', 'report', 'wday', 'solids', 'treat', 'hyd']],",
    "const KEY_TABS = [[/^mp_reports$/, ['mprop', 'report', 'wday', 'solids', 'treat', 'hyd', 'tsht']], [/^bh_/, ['bha']], [/^ts_/, ['tsht']],")
rep("treat: 'What a treatment will do before you add it',", "treat: 'What a treatment will do before you add it', tsht: 'The tour treatment sheet from the mud report, to print or send',")
rep("dd: 'Surveys, the plan and the bit projection',", "dd: 'Surveys, the plan and the bit projection', bha: 'The BHA piece by piece: volumes, strokes and hydraulics',")
rep("solids: 'Solids & dilution', treat: 'Treatment preview',", "solids: 'Solids & dilution', treat: 'Treatment preview', bha: 'BHA',")
rep("w3d: [['tbl-w3-fm', 'Formation tops along the well']],", "w3d: [['tbl-w3-fm', 'Formation tops along the well']], bha: [['tbl-bha-vol', 'Volumes and strokes'], ['tbl-bha', 'The pieces']],")
rep("const REPORT_OFF = new Set(['mprop', 'wc',", "const REPORT_OFF = new Set(['bha', 'mprop', 'wc',")
rep("stuck: updStuck, dvd: updDvd, solids: updSolids, treat: updTreat,", "stuck: updStuck, dvd: updDvd, solids: updSolids, treat: updTreat, tsht: updTsht, bha: updBha,")
# 9 roles: the mud engineer and the directional driller get the new tabs in My tools
rep("tabs: ['calc', 'mprop', 'hyd', 'solids', 'treat', 'report',", "tabs: ['calc', 'mprop', 'hyd', 'tsht', 'bha', 'solids', 'treat', 'report',")
rep("tabs: ['dd', 'w3d', 'ac', 'td', 'buck', 'road', 'stuck', 'geo', 'loc', 'report'], who: ['Directional']", "tabs: ['dd', 'bha', 'w3d', 'ac', 'td', 'buck', 'road', 'stuck', 'geo', 'loc', 'report'], who: ['Directional']")
# 10 voice / search words
if "VC_TABWORDS = { " in s:
    rep("const VC_TABWORDS = { ", "const VC_TABWORDS = { bha: 'bha bottom hole assembly bit motor collars volumes strokes', tsht: 'treatment sheet tour treatments print email', ")
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s))
