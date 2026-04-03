import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DynamicProvider } from './src/providers/DynamicProvider';
import { AppShell } from './src/AppShell';
import { colors } from './src/theme';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <DynamicProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <AppShell />
      </DynamicProvider>
    </SafeAreaProvider>
  );
}

export default App;
// React Native app
