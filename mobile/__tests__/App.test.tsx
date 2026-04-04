import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import App from '../App';

test('renders sleepmask shell', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
