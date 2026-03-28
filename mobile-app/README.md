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

## Notes

- `EXPO_PUBLIC_API_URL` should point at the backend NestJS service.
- For Android emulators, use `http://10.0.2.2:3001` instead of `localhost`.
- Visit logs are queued locally in `AsyncStorage` when the device is offline or the API call fails.
- Location permission is required for turf starts, turf ends, and visit submission.

## Mobile Release Pipeline

This app is configured for Expo Application Services (EAS) builds and store submission.

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

### Internal distribution

Use internal builds for QA or field pilots:

```bash
npm run eas:build:ios:preview
npm run eas:build:android:preview
```

- iOS preview builds are typically distributed through TestFlight or internal install links.
- Android preview builds can be distributed through Play Internal Testing or direct internal install artifacts.

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

## Role Model Note

The current mobile app still implements the canvasser flow only. The client’s newer role model adds `supervisor` as a core role, which should be handled as product/application work separately from the deployment pipeline.
