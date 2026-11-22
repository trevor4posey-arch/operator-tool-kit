# Operator Tool Kit

A single-file offline web app for the rig: mud, well control, casing and cement, drilling, planning, vendors and geology. It runs in any browser with no internet; inputs stay on each computer.

- `app/` is the desktop package: `Operator Tool Kit.html` plus the installers (see `app/README.txt`).
- `src/` holds the source of features added to the HTML and the scripts that splice each one in (`python3 src/<feature>/splice.py in.html out.html`).

The working copy lives on the PC "Ale" in `Desktop\Work\Ops Tool Kit`. The DMR workbooks are not in this repo, and the built-in well data (daily reports and offset costs) and offset well names are removed from this copy: `tools/strip-well-data.py` does that to any Tool Kit file.
