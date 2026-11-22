#!/bin/sh
# Installs Operator Tool Kit as a Mac app. In Terminal, type  sh  and a space, drag this file into the window, press Return.
# It builds "Operator Tool Kit.app" in the Applications folder in your home folder (Launchpad and Spotlight find it). The app
# opens the toolkit in its own window with Chrome, Edge or Brave, or in Safari if none of them is installed. No internet needed.
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
APP="$HOME/Applications/Operator Tool Kit.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$DIR/Operator Tool Kit.html" "$APP/Contents/Resources/"
cp "$DIR/icon.icns" "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Operator Tool Kit</string>
  <key>CFBundleDisplayName</key><string>Operator Tool Kit</string>
  <key>CFBundleIdentifier</key><string>local.operator-tool-kit</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
</dict>
</plist>
PLIST
cat > "$APP/Contents/MacOS/launch" <<'LAUNCH'
#!/bin/sh
# Opens Operator Tool Kit in its own window (Chrome, Edge or Brave app mode), or in Safari
HTML="$(cd "$(dirname "$0")/../Resources" && pwd)/Operator Tool Kit.html"
URL="file://$(printf '%s' "$HTML" | sed 's/ /%20/g')"
for B in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
  if [ -d "/Applications/$B.app" ] || [ -d "$HOME/Applications/$B.app" ]; then
    exec open -na "$B" --args --app="$URL"
  fi
done
exec open "$HTML"
LAUNCH
chmod +x "$APP/Contents/MacOS/launch"
touch "$APP"
echo ""
echo "Operator Tool Kit is installed: $APP"
echo "Open it from Launchpad or Spotlight, and drag it to the Dock to keep it there."
