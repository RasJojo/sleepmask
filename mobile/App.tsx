import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell } from './src/AppShell';
import { colors } from './src/theme';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <AppShell />
    </SafeAreaProvider>
  );
}

export default App;
