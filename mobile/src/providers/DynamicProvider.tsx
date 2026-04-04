import React from 'react';

import { dynamicClient } from '../services/dynamic';

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  const DynamicWebView = dynamicClient.reactNative.WebView;

  return (
    <>
      {children}
      <DynamicWebView />
    </>
  );
}
