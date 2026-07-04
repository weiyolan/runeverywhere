import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Run Everywhere',
  slug: 'runeverywhere',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'runeverywhere',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.runeverywhere.app',
    supportsTablet: false,
    config: {
      // Google Maps SDK for iOS (react-native-maps, PROVIDER_GOOGLE)
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
    },
    // Phase 4 (live run recording) adds:
    // infoPlist: { UIBackgroundModes: ['location'] } + location usage strings
  },
  android: {
    package: 'com.runeverywhere.app',
    adaptiveIcon: {
      backgroundColor: '#CCFF00',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    config: {
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID },
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0B0C',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Saira-Regular.ttf',
          './assets/fonts/Saira-Medium.ttf',
          './assets/fonts/Saira-SemiBold.ttf',
          './assets/fonts/Saira-Bold.ttf',
          './assets/fonts/SairaCondensed-Medium.ttf',
          './assets/fonts/SairaCondensed-SemiBold.ttf',
          './assets/fonts/SairaCondensed-Bold.ttf',
          './assets/fonts/SairaCondensed-ExtraBold.ttf',
          './assets/fonts/SairaCondensed-Black.ttf',
        ],
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Run Everywhere shows runs near you and lets you drop a start point on the map.',
        // Phase 4 enables background recording:
        // locationAlwaysAndWhenInUsePermission, isAndroidForegroundServiceEnabled: true
      },
    ],
    'expo-notifications',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      // Filled by `eas init`
      // projectId: '...',
    },
  },
});
