import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../src/providers/DynamicProvider', () => ({
  DynamicProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../src/AppShell', () => {
  const { Text } = require('react-native');

  return {
    AppShell: () => <Text>Sleepmask shell</Text>,
  };
});

import App from '../App';

test('renders sleepmask shell', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
