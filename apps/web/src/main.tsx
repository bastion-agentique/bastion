import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

// Detect wallet extension conflicts early — before any wallet library imports.
// Multiple extensions (MetaMask, Phantom, Rabby, evmAsk, etc.) race to define
// window.ethereum. If it's already locked as a getter-only property, we must
// skip the injected connector entirely to prevent wagmi/viem from crashing with
// "Cannot read properties of undefined (reading '_bn')" and similar errors.
//
// This flag is checked by App.tsx before constructing EVM connectors.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__BASTION_EVM_LOCKED = false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
    if (descriptor) {
      const isGetterOnly = !descriptor.writable && !descriptor.set;
      const isGetter = typeof descriptor.get === 'function';
      if (isGetterOnly || isGetter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__BASTION_EVM_LOCKED = true;
        console.warn(
          '[Bastion] window.ethereum is locked (getter-only). ' +
          'Multiple wallet extensions are conflicting. ' +
          'Injected EVM wallet connector disabled — use WalletConnect instead. ' +
          'Solana wallet is unaffected.',
        );
      }
    }
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__BASTION_EVM_LOCKED = true;
  }
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);