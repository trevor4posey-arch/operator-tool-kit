import sys, re
src, js, out = sys.argv[1], sys.argv[2], sys.argv[3]
h = open(src, encoding='utf-8').read()
if 'id="tab-cpf"' in h:
    sys.exit('already spliced')
def once(old, new):
    global h
    n = h.count(old)
    if n != 1:
        sys.exit('anchor found %d times: %r' % (n, old[:80]))
    h = h.replace(old, new)
# 1. tab button after Offset explorer
once('<button role="tab" data-tab="off" data-group="mud" aria-selected="false">Offset explorer</button>',
     '<button role="tab" data-tab="off" data-group="mud" aria-selected="false">Offset explorer</button>\n    <button role="tab" data-tab="cpf" data-group="mud" aria-selected="false">Cost per foot & losses</button>')
# 2. the section after the offset explorer section
sec = '''  <!-- COST PER FOOT & LOST CIRCULATION -->
  <section class="tab" id="tab-cpf">
    <aside class="panel inputs" id="in-cpf"></aside>
    <div>
      <div class="tiles" id="tiles-cpf"></div>
      <div class="card" id="cpf-proof"></div>
      <div class="card"><h2>Mud cost per foot by depth</h2><p class="sub">Mud cost to date over the feet drilled, at each report, against the offsets at the same depth and the mud program’s budget.</p><div id="leg-cpf-cost" class="legend"></div><div class="chart" id="ch-cpf-cost"></div></div>
      <div class="card"><h2>Mud cost to date by depth</h2><p class="sub">What the mud had cost by each depth on this well and on the offsets. Lower is cheaper to the same depth.</p><div id="leg-cpf-cum" class="legend"></div><div class="chart" id="ch-cpf-cum"></div></div>
      <div class="card"><h2>By interval</h2><p class="sub">Each interval on the reports, its cost per foot, the offsets’ cost over the same depths and the budget.</p><div class="scroll" id="tbl-cpf-int"></div></div>
      <div class="card"><h2>Lost circulation events</h2><p class="sub">Built from the reports’ downhole losses: where, how much, the LCM it took and how long to cure.</p><div class="scroll tleft" id="tbl-cpf-lc"></div><div id="cpf-lc-edit"></div></div>
      <div class="card"><h2>LCM used</h2><p class="sub">Every LCM product on the reports, split between loss events and background treatment.</p><div class="scroll" id="tbl-cpf-lcm"></div></div>
      <div class="card"><h2>Day by day</h2><details><summary>Table view</summary><div class="scroll" id="tbl-cpf-day"></div></details></div>
      <div class="card notes" id="notes-cpf"></div>
    </div>
  </section>
'''
i = h.index('<section class="tab" id="tab-off">')
j = h.index('</section>', i) + len('</section>\n')
h = h[:j] + sec + h[j:]
# 3. redraw map
once('off: updOff,', 'off: updOff, cpf: updCpf,')
# 4. the JS block before the start-up calls at the end of the last script
code = open(js, encoding='utf-8').read()
once('\nacctGuards();   // read-only', '\n' + code + 'acctGuards();   // read-only')
open(out, 'w', encoding='utf-8', newline='').write(h)
print('ok', len(h))
