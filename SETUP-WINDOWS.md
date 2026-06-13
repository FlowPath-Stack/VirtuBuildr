# Setting up VirtuBuildr on Windows

This guide gets a **Windows 10/11** machine to the point where you can edit the
app, preview it in a browser, and build the Android **APK** yourself.

There are two parts:

1. **[Part A — Edit & run the web app](#part-a--edit--run-the-web-app)** (light, ~15 min)
2. **[Part B — Build the Android APK](#part-b--build-the-android-apk)** (heavier, ~1 hr incl. downloads)

> Tip: you don't *have* to build the APK locally — you can always push a change
> and let GitHub Actions build it for you (see [Part C](#part-c--let-the-cloud-build-it)).

---

## Install the tools

Open **PowerShell** and install everything with `winget` (built into Windows 11
and recent Windows 10). Copy-paste these one at a time:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Microsoft.VisualStudioCode -e
winget install --id EclipseAdoptium.Temurin.21.JDK -e
```

These give you, in order: **Git**, **Node.js (LTS)** + npm, **VS Code**, and
**Java 21** (needed for the Android build).

Close and reopen PowerShell, then confirm they're on your PATH:

```powershell
git --version
node -v
npm -v
java -version
```

If any command isn't found, sign out/in (or reboot) so PATH changes take effect.

---

## Get the code

```powershell
cd $HOME\Documents
git clone https://github.com/FlowPath-Stack/VirtuBuildr.git
cd VirtuBuildr
git checkout claude/mobile-bim-estimates-rm00p8
npm install
```

Open it in your editor with `code .`

---

## Part A — Edit & run the web app

The app is plain HTML/CSS/JS at the repo root:

| File | What it is |
|------|------------|
| `index.html` | Layout / tabs |
| `styles.css` | Styling |
| `app.js` | Estimator engine, PDF viewer, equipment list |

Start a local preview server:

```powershell
npm run web
```

Open **http://localhost:8080** in your browser. Edit a file, save, and refresh
to see changes. (Use a real server like this rather than double-clicking
`index.html` — the PDF viewer and offline support need `http://`, not `file://`.)

Press **Ctrl+C** in PowerShell to stop the server.

---

## Part B — Build the Android APK

### 1. Install Android Studio (gives you the Android SDK)

```powershell
winget install --id Google.AndroidStudio -e
```

Launch **Android Studio** once and complete the **Setup Wizard** (choose
*Standard*). This downloads the Android SDK, platform tools, and an emulator.
Then make sure the right SDK pieces are installed:

1. On the welcome screen: **More Actions → SDK Manager** (or **Settings →
   Languages & Frameworks → Android SDK**).
2. **SDK Platforms** tab → check **Android 15 (API 35)**.
3. **SDK Tools** tab → check **Android SDK Build-Tools** and **Android SDK
   Platform-Tools** → **Apply** to install.

### 2. Point Windows at the SDK

In **PowerShell**, set the environment variables (adjust the path only if you
installed the SDK elsewhere — the default is shown):

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx ANDROID_SDK_ROOT "$env:LOCALAPPDATA\Android\Sdk"
```

Close and reopen PowerShell so the variables load.

### 3. Generate the Android project

The `android/` folder isn't committed (it's generated). Create it once:

```powershell
cd $HOME\Documents\VirtuBuildr
npm run add:android
```

Re-run this only if you delete the `android/` folder. After editing web files,
just run `npm run sync` to copy them into the native project.

### 4. Build the APK

**Easiest — from the command line:**

```powershell
npm run build:apk:win
```

When it finishes, your installable APK is at:

```
android\app\build\outputs\apk\debug\app-debug.apk
```

Copy that file to your phone and tap to install.

**Or — from Android Studio (GUI):**

```powershell
npm run open:android
```

This opens the project in Android Studio. Then **Build → Build Bundle(s) /
APK(s) → Build APK(s)**, and click the **locate** link when it's done. You can
also plug in your phone (with USB debugging on) and press **Run ▶** to install
and launch it directly.

---

## Part C — Let the cloud build it

No Android tooling required. After pushing a change to the
`claude/mobile-bim-estimates-rm00p8` branch:

1. Go to the repo on GitHub → **Actions** tab.
2. Select **Build Android APK** → **Run workflow**.
3. When it's green, open the run and download the **VirtuBuildr-APK** artifact.

Pushing a tag like `v1.2` also attaches the APK to a GitHub **Release**.

---

## Everyday workflow

```powershell
git checkout claude/mobile-bim-estimates-rm00p8
git pull                      # get latest
npm run web                   # edit + preview at localhost:8080
# ...make changes...
npm run build:apk:win         # (optional) build APK locally
git add -A
git commit -m "Describe your change"
git push
```

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `npm` / `git` / `java` "not recognized" | Reopen the terminal or reboot so PATH updates. |
| Build fails: *SDK location not found* | `ANDROID_HOME` isn't set — redo Part B step 2 and reopen the terminal. |
| Build fails: *Unsupported Java / requires JDK XX* | Confirm `java -version` shows 21; the Temurin 21 install above provides it. |
| `gradlew.bat` "not recognized" | Run it from inside the `android` folder, or use `npm run build:apk:win` from the repo root. |
| Gradle is slow the first time | Normal — it downloads dependencies once, then caches them. |
| PDF won't load when opening `index.html` directly | Use `npm run web` and open `http://localhost:8080` instead. |
