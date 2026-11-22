# Operator Tool Kit

A single-file offline web app for the rig: mud, well control, casing and cement, drilling, planning, vendors and geology. It runs in any browser with no internet; inputs stay on each computer.

- `app/` is the desktop package: `Operator Tool Kit.html` plus the installers (see `app/README.txt`).
- `src/` holds the source of features added to the HTML and the scripts that splice each one in (`python3 src/<feature>/splice.py in.html out.html`).

The working copy lives on the PC "Ale" in `Desktop\Work\Ops Tool Kit`. The DMR workbooks are not in this repo, and the built-in well data (daily reports and offset costs) and offset well names are removed from this copy: `tools/strip-well-data.py` does that to any Tool Kit file.

## Install as an app

Once GitHub Pages is on (Settings › Pages › Deploy from a branch › `main`, `/ (root)`), the tool kit opens at
https://trevor4posey-arch.github.io/operator-tool-kit/ and can be installed:

- **Windows or Mac:** open the link in Chrome or Edge and click **Install** in the address bar.
- **iPhone:** open the link in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open the link in Chrome and tap **Install app**.

After it has been opened once, it works with no signal. `manifest.webmanifest`, `sw.js` and `icons/` make this work.
If the app page is rebuilt, run `python3 tools/add-app-install.py "app/Operator Tool Kit.html"` to put the install tags back.
The downloaded `.html` file still works on its own.
