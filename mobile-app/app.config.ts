import type { ExpoConfig } from 'expo/config';

const appEnv = process.env.APP_ENV ?? 'development';
const projectId = process.env.EAS_PROJECT_ID;
const owner = process.env.EXPO_OWNER;

const appName = process.env.EXPO_PUBLIC_APP_NAME ?? 'PROACTIVE FCS';
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const geofenceRadius = Number(process.env.EXPO_PUBLIC_GEOFENCE_RADIUS_METERS ?? '100');
const iosBundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER ?? 'com.proactive.fcs';
const androidPackage = process.env.ANDROID_APPLICATION_ID ?? 'com.proactive.fcs';

const config: ExpoConfig = {
  name: appName,
  slug: 'proactive-field-canvassing-system',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'proactivefcs',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F6F1E6'
  },
  runtimeVersion: {
    policy: 'appVersion'
  },
  ios: {
    bundleIdentifier: iosBundleIdentifier,
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'PROACTIVE uses your location to validate visit submissions and turf check-ins.'
    }
  },
  android: {
    package: androidPackage,
    adaptiveIcon: {
      backgroundColor: '#D6A21E',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png'
    },
    predictiveBackGestureEnabled: false
  },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'PROACTIVE uses your location to validate visit submissions and turf check-ins.'
      }
    ]
  ],
  web: {
    favicon: './assets/favicon.png'
  },
  extra: {
    appEnv,
    apiUrl,
    geofenceRadius,
    eas: projectId
      ? {
          projectId
        }
      : undefined
  }
};

if (owner) {
  config.owner = owner;
}

if (projectId) {
  config.updates = {
    url: `https://u.expo.dev/${projectId}`,
    fallbackToCacheTimeout: 0
  };
}

export default config;
