const path = require('path');
const { resolve } = require('metro-resolver');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const EDSDA_BLAKE2B_PATH = path.resolve(
  __dirname,
  'node_modules/@zk-kit/eddsa-poseidon/dist/lib.esm/eddsa-poseidon-blake-2b.js',
);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest(context, moduleName, platform) {
      if (moduleName === '@zk-kit/eddsa-poseidon/blake-2b') {
        return {
          filePath: EDSDA_BLAKE2B_PATH,
          type: 'sourceFile',
        };
      }

      return resolve(context, moduleName, platform);
    },
    extraNodeModules: {
      buffer: require.resolve('buffer'),
      module: require.resolve('./shims/module.js'),
      'react-dom': require.resolve('./shims/react-dom.js'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
