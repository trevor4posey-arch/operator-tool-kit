"""Add the install-as-app tags to the tool kit page (safe to run twice).

Usage: python3 tools/add-app-install.py "app/Operator Tool Kit.html"

The tags point at manifest.webmanifest, sw.js and icons/ in the site root.
Opened as a downloaded file, the page ignores them and works as before.
"""
import sys

MARK = '<!-- install as app -->'
TAGS = MARK + '''
<link rel="manifest" href="../manifest.webmanifest">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
<meta name="theme-color" content="#2876d4">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Tool Kit">
<script>
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {}));
}
</script>
'''

path = sys.argv[1]
h = open(path, encoding='utf-8').read()
if MARK in h:
    print('already added'); sys.exit()
i = h.index('</head>')
h = h[:i] + TAGS + h[i:]
open(path, 'w', encoding='utf-8', newline='').write(h)
print('ok')
