import { createClient } from '@dynamic-labs/client';
import { LogLevel } from '@dynamic-labs/logger';
import { ReactNativeExtension } from '@dynamic-labs/react-native-extension';
import { ViemExtension } from '@dynamic-labs/viem-extension';

import { baseSepoliaNetwork, config } from './config';

const DYNAMIC_DEBUG = false;
const DYNAMIC_EVENT_LOG = __DEV__;

export const dynamicClient = createClient({
  environmentId: config.dynamicEnvId,
  appName: 'Sleepmask',
  appLogoUrl: `${config.appOrigin}/favicon.ico`,
  evmNetworks: [baseSepoliaNetwork],
  debug: DYNAMIC_DEBUG
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

if (DYNAMIC_EVENT_LOG) {
  dynamicClient.auth.on('authInit', payload => {
    console.log('[Dynamic] authInit', payload);
  });

  dynamicClient.auth.on('authSuccess', user => {
    console.log('[Dynamic] authSuccess', user);
  });

  dynamicClient.auth.on('authFailed', (payload, reason) => {
    console.warn('[Dynamic] authFailed', payload, reason);
  });

  dynamicClient.wallets.on('walletAdded', payload => {
    console.log('[Dynamic] walletAdded', payload);
  });

  dynamicClient.wallets.on('walletReturnFromDeepLink', async payload => {
    console.log('[Dynamic] walletReturnFromDeepLink', payload);

    try {
      const user = await dynamicClient.auth.refreshUser();
      console.log('[Dynamic] refreshUser after deep link', user);
    } catch (error) {
      console.warn('[Dynamic] refreshUser after deep link failed', error);
    }
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
