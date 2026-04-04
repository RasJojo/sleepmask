// Stub browser globals needed by @dynamic-labs/sdk-react-core (web-only SDK)
if (typeof window !== 'undefined') {
  if (!window.location) {
    window.location = {
      href: 'https://localhost/',
      origin: 'https://localhost',
      protocol: 'https:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
      assign: () => {},
      replace: () => {},
      reload: () => {},
    };
  }
  if (!window.history) {
    window.history = { pushState: () => {}, replaceState: () => {}, go: () => {} };
  }
  if (!window.localStorage) {
    const store = {};
    window.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      key: (i) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    };
  }
  if (!window.sessionStorage) {
    const store = {};
    window.sessionStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      key: (i) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    };
  }
  if (!window.document) {
    window.document = {
      createElement: () => ({ style: {}, setAttribute: () => {}, addEventListener: () => {} }),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      body: { appendChild: () => {}, removeChild: () => {}, style: {} },
      head: { appendChild: () => {}, removeChild: () => {} },
    };
  }
}

// Also stub global.document for non-window environments
if (typeof global !== 'undefined' && !global.document) {
  global.document = {
    createElement: () => ({ style: {}, setAttribute: () => {}, addEventListener: () => {} }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { appendChild: () => {}, removeChild: () => {}, style: {} },
    head: { appendChild: () => {}, removeChild: () => {} },
  };
}
