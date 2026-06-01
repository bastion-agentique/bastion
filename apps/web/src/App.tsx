import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { type Chain } from 'viem';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ChainProvider } from './context/ChainContext';
import { EvmProviderErrorBoundary } from './components/EvmProviderErrorBoundary';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Integrate from './pages/integrate/Integrate';
import '@solana/wallet-adapter-react-ui/styles.css';
import '@rainbow-me/rainbowkit/styles.css';

const SOLANA_RPC = 'https://api.devnet.solana.com';

const queryClient = new QueryClient();

// Manually define Celo chain to avoid BigInt serialization issues
// that can occur when importing from wagmi/chains in bundled environments.
const celo = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://forno.celo.org'] },
  },
  blockExplorers: {
    default: { name: 'CeloScan', url: 'https://celoscan.io' },
  },
  testnet: false,
} as const satisfies Chain;

const CELO_RPC = 'https://forno.celo.org';

const isEthereumLocked = (): boolean => {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).__BASTION_EVM_LOCKED) return true;
  try {
    const desc = Object.getOwnPropertyDescriptor(window, 'ethereum');
    if (!desc) return false;
    return (typeof desc.get === 'function' && !desc.writable && !desc.set)
        || (!desc.writable && !desc.set);
  } catch {
    return true;
  }
};

// Build connectors defensively.
// If window.ethereum is locked by competing extensions, skip the injected
// connector and fall back to WalletConnect-only mode.
const connectors = (() => {
  const list: ReturnType<typeof walletConnect | typeof injected>[] = [
    walletConnect({
      projectId: 'bastion-defend',
      showQrModal: false,
    }),
  ];

  if (!isEthereumLocked()) {
    try {
      list.push(injected({ target: 'metaMask' }));
    } catch {
      console.warn('[Bastion] Injected EVM connector failed to construct (ethereum locked).');
    }
  } else {
    console.warn('[Bastion] window.ethereum is locked. Running in WalletConnect-only mode.');
  }

  return list;
})();

const wagmiConfig = (() => {
  try {
    return createConfig({
      chains: [celo],
      connectors,
      transports: {
        [celo.id]: http(CELO_RPC),
      },
    });
  } catch (e) {
    console.error('[Bastion] Failed to create wagmi config:', e);
    // Return a minimal config with WalletConnect as the only connector.
    return createConfig({
      chains: [celo],
      connectors: [
        walletConnect({
          projectId: 'bastion-defend',
          showQrModal: false,
        }),
      ],
      transports: {
        [celo.id]: http(CELO_RPC),
      },
    });
  }
})();

function AppRoutes() {
  const solanaWallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={solanaWallets} autoConnect>
        <WalletModalProvider>
          <EvmProviderErrorBoundary>
            <WagmiProvider config={wagmiConfig}>
              <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                  <Routes>
                    <Route path="/"          element={<Landing />} />
                    <Route path="/integrate"  element={<Integrate />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="*"          element={<Navigate to="/" replace />} />
                  </Routes>
                </RainbowKitProvider>
              </QueryClientProvider>
            </WagmiProvider>
          </EvmProviderErrorBoundary>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ChainProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ChainProvider>
    </ThemeProvider>
  );
}
