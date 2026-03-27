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
