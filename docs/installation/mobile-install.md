# Mobile Build Workstation Setup

Use this guide to prepare a developer or CI build workstation for the Expo mobile app, local simulator/device testing, internal preview builds, and installing the resulting app on phones.

The install script in this repo does not run on iOS or Android devices. It runs on a developer/build machine and prepares the mobile app workspace. Phones install the app through Expo Go, TestFlight, Google Play Internal Testing, or an Android APK.

Important: `npm run setup:mobile` and the platform-specific `install-mobile` scripts do not create signed mobile binaries. They prepare the build workspace, write environment files, install dependencies, and run validation checks. Preview and production binaries are built later with EAS commands.

## What This Installs

- Root npm workspace dependencies
- `mobile-app/.env`
- Optional `mobile-app/.env.preview`
- Optional `mobile-app/.env.production`
- Mobile TypeScript validation

## Prerequisites

- Node.js `22` or newer
- npm
- Expo-compatible simulator, emulator, or physical device
- Backend API URL reachable from the device
- Expo account and EAS access for preview or production builds

## Install With The Script

From the repo root:

```bash
npm run setup:mobile
```

Direct platform-specific commands:

```bash
scripts/install-mobile.sh
```

```bash
bash scripts/install-mobile-macos.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1
```

This installs dependencies and prepares mobile environment files on your computer. It does not install anything directly onto a phone.

If you need deployment or release steps after setup, continue with [deployment.md](deployment.md).

## Set The Mobile API URL

The mobile app reads `EXPO_PUBLIC_API_URL`.

Use the installer to set it:

```bash
npm run setup:mobile -- --api-url http://localhost:3001
```

Recommended local values:

- iOS simulator: `http://localhost:3001`
- Android emulator: `http://10.0.2.2:3001`
- Physical device: `http://<your-computer-LAN-IP>:3001`

Physical devices cannot use `localhost` unless the backend is running on the device itself.

## Local Mobile Development

Start the backend:

```bash
npm run dev:backend
```

Start Expo:

```bash
npm run dev:mobile
```

Then choose one:

- Press `i` for iOS simulator.
- Press `a` for Android emulator.
- Scan the QR code from Expo Go or a development build on a physical device.

## Install On A Phone For Local Testing

Expo Go path:

1. Install Expo Go from the App Store or Google Play.
2. Run `npm run dev:mobile` on your computer.
3. Make sure the phone and computer are on the same network.
4. Set `EXPO_PUBLIC_API_URL` to a backend URL reachable from the phone, usually `http://<computer-LAN-IP>:3001`.
5. Scan the Expo QR code with the phone.

Development build path:

1. Build a development or preview binary with EAS.
2. Install through the platform-specific method below.
3. Run the backend and confirm the API URL points to a reachable backend.

## Preview Build Setup

Create a local preview environment file for review and manual reference:

```bash
npm run setup:mobile -- --preview-env
```

Edit `mobile-app/.env.preview` and set real values:

```text
EXPO_PUBLIC_API_URL=
EXPO_OWNER=
EAS_PROJECT_ID=
IOS_BUNDLE_IDENTIFIER=
ANDROID_APPLICATION_ID=
```

Important: `mobile-app/.easignore` excludes `.env.preview` and `.env.production`, so EAS cloud builds do not automatically receive those local files. Set the same values in EAS environment variables or secrets before building.

Log in to Expo:

```bash
cd mobile-app
npx eas login
npx eas project:init
```

Set EAS environment variables for preview builds. `EXPO_PUBLIC_*` values are bundled into the app, so use plaintext or sensitive visibility, not secret visibility:

```bash
npx eas env:create --name EXPO_PUBLIC_API_URL --value https://api-preview.example.com --environment preview --visibility plaintext
npx eas env:create --name EXPO_OWNER --value your-expo-owner --environment preview --visibility plaintext
npx eas env:create --name EAS_PROJECT_ID --value your-eas-project-id --environment preview --visibility plaintext
npx eas env:create --name IOS_BUNDLE_IDENTIFIER --value com.example.proactive.preview --environment preview --visibility plaintext
npx eas env:create --name ANDROID_APPLICATION_ID --value com.example.proactive.preview --environment preview --visibility plaintext
```

Build internal preview binaries:

```bash
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

## Internal Distribution

iOS:

- Use TestFlight for normal internal testing.
- Direct iOS sideloading is limited and usually requires Apple ad hoc or enterprise setup.

Android:

- Use the EAS preview APK for direct internal install.
- Use Google Play Internal Testing when you need managed tester groups and update tracking.

## Production Build Setup

Create a local production environment file for review and manual reference:

```bash
npm run setup:mobile -- --production-env
```

On Windows PowerShell, use named parameters instead:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1 -ApiUrl http://localhost:3001
powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1 -PreviewEnv
powershell -ExecutionPolicy Bypass -File scripts/install-mobile.ps1 -ProductionEnv
```

Edit `mobile-app/.env.production` with production API and store identifiers.

Set the same production values in EAS before building:

```bash
cd mobile-app
npx eas env:create --name EXPO_PUBLIC_API_URL --value https://api.example.com --environment production --visibility plaintext
npx eas env:create --name EXPO_OWNER --value your-expo-owner --environment production --visibility plaintext
npx eas env:create --name EAS_PROJECT_ID --value your-eas-project-id --environment production --visibility plaintext
npx eas env:create --name IOS_BUNDLE_IDENTIFIER --value com.example.proactive --environment production --visibility plaintext
npx eas env:create --name ANDROID_APPLICATION_ID --value com.example.proactive --environment production --visibility plaintext
```

Build store artifacts:

```bash
cd mobile-app
npm run eas:build:ios:production
npm run eas:build:android:production
```

Submit store artifacts:

```bash
npm run eas:submit:ios
npm run eas:submit:android
```

## Over-The-Air Updates

Use OTA updates only for JavaScript changes compatible with the installed native runtime.

```bash
cd mobile-app
npm run eas:update:preview
npm run eas:update:production
```

These npm scripts pass the matching EAS environment to `eas update`. Native dependency, permission, bundle identifier, or SDK changes require a new binary build.

## EAS Environment Notes

- Local `.env` files are useful for Expo local development.
- EAS cloud builds need values configured through EAS environment variables/secrets or another explicit CI secret injection mechanism.
- `EXPO_PUBLIC_*` values are bundled into the app and should not contain secrets.
- Store credentials and signing material should stay in Expo, Apple, Google, or CI secret stores, not in this repo.

## Mobile Verification Checklist

- Canvasser can sign in.
- Assigned turf appears.
- Turf can start, pause, resume, and complete.
- Visits submit online.
- Visits queue offline.
- Queued visits sync when connectivity returns.
- Location permission prompts appear at the expected actions.
- Android uses the correct emulator or LAN API URL.
