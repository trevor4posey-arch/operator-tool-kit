#!/bin/sh
# Installs Operator Tool Kit as a Linux desktop app. In a terminal in this folder run:  sh install-linux.sh
# It copies the toolkit to ~/OperatorToolKit (not a hidden folder, so snap and flatpak browsers can read it) and adds it to
# your app menu. It opens in its own window with Chrome, Chromium, Edge or Brave, otherwise in your default browser.
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
DEST="$HOME/OperatorToolKit"
mkdir -p "$DEST"
cp "$DIR/Operator Tool Kit.html" "$DIR/icon.png" "$DEST/"
cat > "$DEST/launch.sh" <<'LAUNCH'
#!/bin/sh
# Opens Operator Tool Kit in its own window (app mode), or in the default browser
HTML="$(cd "$(dirname "$0")" && pwd)/Operator Tool Kit.html"
URL="file://$(printf '%s' "$HTML" | sed 's/ /%20/g')"
for B in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge microsoft-edge-stable brave-browser; do
  if command -v "$B" >/dev/null 2>&1; then exec "$B" --app="$URL"; fi
done
exec xdg-open "$HTML"
LAUNCH
chmod +x "$DEST/launch.sh"
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
mkdir -p "$APPS"
cat > "$APPS/operator-tool-kit.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Operator Tool Kit
Comment=Mud, well control, casing, drilling, cost and geology tools
Exec=$DEST/launch.sh
Icon=$DEST/icon.png
Terminal=false
Categories=Utility;Science;Engineering;
StartupNotify=true
EOF
chmod +x "$APPS/operator-tool-kit.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$APPS" >/dev/null 2>&1 || true; fi
echo ""
echo "Operator Tool Kit is installed in $DEST and is in your app menu."
echo "To remove it: rm -r \"$DEST\" \"$APPS/operator-tool-kit.desktop\""
