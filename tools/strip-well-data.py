"""Remove the built-in well data (daily reports and offset mud costs) and offset well names from a Tool Kit HTML file.
python3 tools/strip-well-data.py in.html out.html  -- keeps the SIM_DATA markers, empties what's between them."""
import re, sys
h = open(sys.argv[1], encoding='utf-8').read()
h2, n = re.subn(r'(<!-- SIM_DATA:BEGIN[^\n]*-->\n).*?(<!-- SIM_DATA:END -->)', r'\1\2', h, flags=re.S)
if n != 1: sys.exit('SIM_DATA markers not found once')
# offset well names in the hint text
for a, b in [("Offsets that lost mud (Milkshake 1 and 2, Audra 4 and 5) fixed it by cutting weight", "Offsets that lost mud fixed it by cutting weight"),
             ("Offsets lost returns running 9⅝″ (Milkshake 2 lost 320 bbl at 13,290′).", "Offsets lost returns running 9⅝″ casing."),
             ("(Milkshake 1 and Audra 5 cut weight to stop losses)", "(some offsets cut weight to stop losses)"),
             ("Your estimate. Milkshake 2 lost returns running casing at 10.9 ppg.", "Your estimate, from offset losses, LOT/FIT data or your best information.")]:
    h2 = h2.replace(a, b)
open(sys.argv[2], 'w', encoding='utf-8', newline='').write(h2)
print('stripped', len(h) - len(h2), 'chars')
