module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js'
    },
    jest: {
      setupTimeout: 180000
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      // Placeholder Expo prebuild output path. Update once native builds are finalized.
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/mobileapp.app',
      build: 'npx expo prebuild --platform ios && xcodebuild -workspace ios/mobileapp.xcworkspace -scheme mobileapp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15'
      }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    }
  }
};
