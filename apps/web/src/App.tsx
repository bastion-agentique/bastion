import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ChainProvider } from './context/ChainContext';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Integrate from './pages/integrate/Integrate';
import '@solana/wallet-adapter-react-ui/styles.css';
import '@rainbow-me/rainbowkit/styles.css';

const SOLANA_RPC = 'https://api.devnet.solana.com';

const queryClient = new QueryClient();

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'Bastion',
    projectId: 'bastion-defend',
    chains: [celo],
    transports: {
      [celo.id]: http('https://forno.celo.org'),
    },
  }),
);

function AppRoutes() {
  const solanaWallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={solanaWallets} autoConnect>
        <WalletModalProvider>
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
