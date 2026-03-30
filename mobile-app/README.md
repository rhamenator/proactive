# PROACTIVE FCS Mobile App

Expo-based canvasser app for turf work, house-by-house logging, GPS capture, and offline visit queueing.

## Setup

1. Install dependencies:

```bash
cd /home/rich/dev/proactive/mobile-app
npm install
```

2. Set your API URL:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm start
```

## Local App Use

Use this path for development and day-to-day QA.

1. Make sure the backend API is running from the repo root:

```bash
npm run dev:backend
```

2. Start the Expo app from [mobile-app](/home/rich/dev/proactive/mobile-app):

```bash
npm start
```

3. Open the app on:

- an iOS simulator
- an Android emulator
- a physical device through Expo Go or a development build

4. Sign in with a canvasser account and verify:

- assigned turf appears
- session start/pause/resume/complete actions work
- visits queue offline and sync when connectivity returns
- GPS prompts appear when turf or visit actions require location

## Notes

- `EXPO_PUBLIC_API_URL` should point at the backend NestJS service.
- For Android emulators, use `http://10.0.2.2:3001` instead of `localhost`.
- Visit logs, queue state, and local address state are persisted in the on-device SQLite store when the device is offline or the API call fails.
- Location permission is required for turf starts, turf ends, and visit submission.

## Mobile Release Pipeline

This app is configured for Expo Application Services (EAS) builds and store submission.

GitHub Actions currently supports mobile release preparation, not signed mobile binary output. The trusted release workflow packages:

- resolved Expo config from GitHub Actions
- `eas.json`
- environment templates
- release notes inputs for maintainers

That artifact is useful for auditing and handoff, but it is not an installable build.

### Required configuration

1. Copy one of the environment templates and fill in the real values:

```bash
cp .env.preview.example .env.preview
cp .env.production.example .env.production
```

2. Set the required identifiers and release settings:

- `EXPO_PUBLIC_API_URL`
- `EXPO_OWNER`
- `EAS_PROJECT_ID`
- `IOS_BUNDLE_IDENTIFIER`
- `ANDROID_APPLICATION_ID`

3. Log in to Expo and link the app to an EAS project:

```bash
npx eas login
npx eas project:init
```

### What GitHub can and cannot do today

GitHub release automation in this repo can safely do the following without private store credentials:

- verify that Expo config resolves in CI
- archive release-prep inputs for maintainers
- keep backend/admin release artifacts tied to the same GitHub run and provenance

It does not currently do the following automatically:

- create signed IPA or AAB/APK artifacts
- submit builds to App Store Connect
- submit builds to Google Play
- manage Apple or Google signing credentials

Those steps remain blocked on real secrets and platform accounts:

- `EXPO_TOKEN`
- `EXPO_OWNER`
- `EAS_PROJECT_ID`
- `IOS_BUNDLE_IDENTIFIER`
- `ANDROID_APPLICATION_ID`
- Apple signing credentials
- Google Play credentials if applicable

### Internal distribution

Use internal builds for QA or field pilots:

```bash
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

#### iOS internal testing

Recommended path:

1. Build the preview binary:

```bash
npm run eas:build:ios:preview
```

2. Upload/distribute through TestFlight.
3. Add internal testers in App Store Connect.
4. Testers install the app through the TestFlight app.

Notes:

- This is the safest in-org iPhone/iPad path.
- True direct sideloading on iOS is limited and usually requires Apple ad hoc or enterprise distribution setup outside normal local install flows.

#### Android internal testing and side-loading

Recommended path for fastest in-org testing:

1. Build the preview binary:

```bash
npm run eas:build:android:preview
```

2. Download the generated APK or internal artifact from EAS.
3. Transfer it to the tester device.
4. On the Android device, allow installs from the file manager/browser if prompted.
5. Open the APK and install it.

Alternative managed path:

- Use Google Play Internal Testing if you want tester groups, version tracking, and managed updates instead of manual APK installs.

#### Internal tester checklist

Before handing the app to non-engineering staff, verify:

- preview build points to the correct preview/staging API
- tester accounts already exist and have assigned turf
- GPS permissions are described to testers in advance
- at least one full online workflow and one offline-sync workflow have been tested
- Android testers know whether they are installing a direct APK or using Play Internal Testing
- iOS testers know they will install through TestFlight

### Production store builds

Build signed store artifacts:

```bash
npm run eas:build:ios:production
npm run eas:build:android:production
```

Submit them:

```bash
npm run eas:submit:ios
npm run eas:submit:android
```

### Over-the-air updates

After a production binary is installed, JavaScript-only updates can be shipped through EAS Update:

```bash
npm run eas:update:preview
npm run eas:update:production
```

Use this only for changes compatible with the installed runtime version. Native dependency or permission changes still require a new store build.

## Recommended In-Org Test Flow

1. Build `preview` binaries, not `production`.
2. Point preview builds at a non-production backend.
3. Seed or create canvasser test accounts before distribution.
4. Assign one or more test turfs before testers sign in.
5. Distribute through TestFlight on iOS and either direct APK install or Play Internal Testing on Android.
6. Ask testers to verify:

- login
- turf visibility
- session lifecycle
- visit logging
- offline queueing
- sync recovery
- GPS permission and validation behavior

## Role Model Note

The mobile app intentionally implements the canvasser flow only. Supervisors use the web dashboard for operational review, turf management, and GPS exception handling.
