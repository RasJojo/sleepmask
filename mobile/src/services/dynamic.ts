import { createClient } from '@dynamic-labs/client';
import { LogLevel } from '@dynamic-labs/logger';
import { ReactNativeExtension } from '@dynamic-labs/react-native-extension';
import { ViemExtension } from '@dynamic-labs/viem-extension';

import { baseSepoliaNetwork, config } from './config';

export const dynamicClient = createClient({
  environmentId: config.dynamicEnvId,
  appName: 'Sleepmask',
  appLogoUrl: `${config.appOrigin}/favicon.ico`,
  evmNetworks: [baseSepoliaNetwork],
  useMetamaskSdk: true,
  debug: __DEV__
    ? {
        webview: true,
        messageTransport: true,
        loggerLevel: LogLevel.DEBUG,
      }
    : undefined,
}).extend(
  ReactNativeExtension({
    appOrigin: config.appOrigin,
    webviewDebuggingEnabled: __DEV__,
  }),
).extend(ViemExtension());

if (__DEV__) {
  dynamicClient.wallets.setHandler('walletConnected', async wallet => {
    // Keep the connection flow accepted while exposing the connector details in logcat.
    console.log('[Dynamic] walletConnected', wallet);
    return true;
  });

  dynamicClient.sdk.on('loadedChanged', loaded => {
    console.log('[Dynamic] sdk.loadedChanged', loaded);
  });

  dynamicClient.sdk.on('error', error => {
    if (error) {
      console.warn('[Dynamic] sdk.error', error);
    }
  });
}
