const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      module: require.resolve('./shims/module.js'),
      'react-dom': require.resolve('./shims/react-dom.js'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
