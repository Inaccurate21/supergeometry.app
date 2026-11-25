#!/usr/bin/env bash
# Builds the Android app (no Gradle: the SDK's own tools) into
# public/supergeometry.apk, with public/apk.json saying its version - the site
# serves both, and Settings → Updates links to it.
#   ANDROID_HOME=/path/to/sdk bash android/build.sh
# Needs the SDK's platforms;android-35 and build-tools;35.0.0, and a JDK.
# libs/: Samsung's S Pen Remote SDK (the pen's button and motion from afar), as PenMouseS uses it.
# Its version is package.json's appVersion (D.K.Z.P); the version code is
# D*1000000 + K*10000 + Z*100 + P.
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-/home/user/android-sdk}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-35/android.jar"
NAME=$(node -p "require('../package.json').appVersion")
CODE=$(node -p "const [d,k,z,p]='$NAME'.split('.').map(Number); d*1e6+k*1e4+z*100+p")
rm -rf build && mkdir -p build/gen build/classes build/dex
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml \
  --version-code "$CODE" --version-name "$NAME" --min-sdk-version 29 --target-sdk-version 34 \
  --java build/gen build/res.zip
LIBS="libs/sdk-v1.0.0.jar:libs/spenremote-v1.0.1.jar"
javac -nowarn --release 11 -classpath "$JAR:$LIBS" -d build/classes $(find src build/gen -name '*.java') 2>&1 | grep -v '^Picked up' || true
"$BT/d8" --release --lib "$JAR" --min-api 29 --output build/dex $(find build/classes -name '*.class') libs/sdk-v1.0.0.jar libs/spenremote-v1.0.1.jar
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
# The same key every time, so a new version installs over the old one (its projects stay).
"$BT/apksigner" sign --ks supergeometry.jks --ks-pass pass:supergeometry --key-pass pass:supergeometry \
  --out ../public/supergeometry.apk build/aligned.apk
printf '{"versionName":"%s","versionCode":%s}\n' "$NAME" "$CODE" > ../public/apk.json
rm -f ../public/supergeometry.apk.idsig
echo "public/supergeometry.apk $NAME ($CODE): $(du -h ../public/supergeometry.apk | cut -f1)"
