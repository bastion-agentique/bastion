import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { 
  WalletProvider, 
  useWallet, 
  ConnectionProvider 
} from '@solana/wallet-adapter-react';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletModalProvider, useWalletModal } from '@solana/wallet-adapter-react-ui';
import { 
  WalletMultiButton, 
  WalletDisconnectButton 
} from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

const ENDPOINTS = [
  { name: 'devnet', url: 'https://api.devnet.solana.com' },
  { name: 'mainnet', url: 'https://api.mainnet-beta.solana.com' },
];

interface AuditEntry {
  id: string;
  timestamp: number;
  decision: 'ALLOWED' | 'BLOCKED' | 'PENDING';
  account: string;
  intent: string;
  reason: string;
}

interface Policy {
  maxSolPerTx: number;
  maxBalanceDrain: number;
  rateLimit: number;
  allowedPrograms: string[];
  blockedAddresses: string[];
}

const DEFAULT_POLICY: Policy = {
  maxSolPerTx: 1,
  maxBalanceDrain: 100000000,
  rateLimit: 10,
  allowedPrograms: [
    '11111111111111111111111111111111', // System
    'TokenkegZwpDfbvXPB9SSct59MSBhGUMCfX2LzXBe', // Token
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
  ],
  blockedAddresses: [],
};

function Dashboard() {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<'pending' | 'logs' | 'policy'>('pending');
  const [pending, setPending] = useState<AuditEntry[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [stats, setStats] = useState({ total: 0, allowed: 0, blocked: 0 });
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const mockLogs: AuditEntry[] = [
      { id: '1', timestamp: Date.now() / 1000, decision: 'ALLOWED', account: '7xFX...3kN9', intent: 'Swap 0.5 SOL → USDC', reason: 'Policy passed' },
      { id: '2', timestamp: Date.now() / 1000 - 60, decision: 'BLOCKED', account: '9mB2...7pL4', intent: 'Transfer 10 SOL', reason: 'Exceeds max' },
      { id: '3', timestamp: Date.now() / 1000 - 120, decision: 'ALLOWED', account: '3fR5...8kM2', intent: 'Mint NFT', reason: 'Whitelisted program' },
    ];
    setLogs(mockLogs);
    setStats({ total: 156, allowed: 142, blocked: 14 });
  }, []);

  const handleAllow = useCallback((id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
    setLogs(prev => [{ id, timestamp: Date.now() / 1000, decision: 'ALLOWED' as const, account: '', intent: 'Override: Allow', reason: 'Human approved' }, ...prev]);
    setStats(s => ({ ...s, allowed: s.allowed + 1 }));
  }, []);

  const handleReject = useCallback((id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
    setLogs(prev => [{ id, timestamp: Date.now() / 1000, decision: 'BLOCKED' as const, account: '', intent: 'Override: Reject', reason: 'Human rejected' }, ...prev]);
    setStats(s => ({ ...s, blocked: s.blocked + 1 }));
  }, []);

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-bastion-500 to-bastion-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">BASTION</h1>
            <p className="text-gray-500 text-sm">AI Agent Firewall</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isPaused ? 'bg-red-900/30 text-red-400 border border-red-500/50' : 'bg-green-900/30 text-green-400 border border-green-500/50'}`}>
            {isPaused ? '⏸ PAUSED' : '● LIVE MONITORING'}
          </span>
          <WalletMultiButton />
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-gray-500 text-xs uppercase">Total Audits</p>
          <p className="text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-gray-500 text-xs uppercase">Allowed</p>
          <p className="text-3xl font-bold text-green-400">{stats.allowed}</p>
        </div>
        <div className="card p-4">
          <p className="text-gray-500 text-xs uppercase">Blocked</p>
          <p className="text-3xl font-bold text-red-400">{stats.blocked}</p>
        </div>
        <div className="card p-4">
          <p className="text-gray-500 text-xs uppercase">Block Rate</p>
          <p className="text-3xl font-bold text-yellow-400">
            {stats.total > 0 ? ((stats.blocked / stats.total) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'logs', 'policy'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === tab 
                ? 'bg-bastion-600 text-white' 
                : 'bg-transparent text-gray-400 hover:bg-white/5'
            }`}
          >
            {tab === 'pending' ? '⏳ Pending' : tab === 'logs' ? '📜 Audit Logs' : '⚙️ Policy'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card p-6">
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pending.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">No transactions awaiting approval.</p>
            ) : (
              pending.map(item => (
                <div key={item.id} className="p-4 glass rounded-lg border-l-4 border-yellow-500">
                  <div className="flex justify-between mb-2">
                    <span className="text-yellow-500 font-bold">⚠️ Pending Approval</span>
                    <span className="text-gray-500 text-sm">{new Date(item.timestamp * 1000).toLocaleTimeString()}</span>
                  </div>
                  <p className="mb-2">{item.intent}</p>
                  <p className="text-gray-400 text-sm mb-4">{item.reason}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleAllow(item.id)} className="btn-primary flex-1">ALLOW</button>
                    <button onClick={() => handleReject(item.id)} className="btn-danger flex-1">REJECT</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className={`p-3 glass rounded-lg border-l-4 ${
                log.decision === 'ALLOWED' ? 'border-green-500' : 'border-red-500'
              }`}>
                <div className="flex justify-between">
                  <span className={log.decision === 'ALLOWED' ? 'text-green-400' : 'text-red-400'}>
                    {log.decision}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {new Date(log.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm mt-1">{log.intent}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'policy' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold mb-2">Max SOL per Transaction</h3>
              <input 
                type="number" 
                value={policy.maxSolPerTx}
                onChange={e => setPolicy(p => ({ ...p, maxSolPerTx: Number(e.target.value) }))}
                className="w-full p-3 glass rounded-lg bg-transparent border border-white/10"
              />
            </div>
            <div>
              <h3 className="font-bold mb-2">Rate Limit (per minute)</h3>
              <input 
                type="number" 
                value={policy.rateLimit}
                onChange={e => setPolicy(p => ({ ...p, rateLimit: Number(e.target.value) }))}
                className="w-full p-3 glass rounded-lg bg-transparent border border-white/10"
              />
            </div>
            <div>
              <h3 className="font-bold mb-2">Allowed Programs</h3>
              <div className="space-y-1">
                {policy.allowedPrograms.map((prog, i) => (
                  <code key={i} className="block text-sm text-gray-400 p-2 glass rounded">
                    {prog.slice(0, 8)}...{prog.slice(-8)}
                  </code>
                ))}
              </div>
            </div>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className={`w-full py-3 rounded-lg font-bold ${isPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
            >
              {isPaused ? '▶ RESUME PROTOCOL' : '⏸ PAUSE PROTOCOL (Emergency)'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-gray-600 text-sm">
        <p>Bastion v0.2.0 • Built for the Solana Frontier Hackathon</p>
      </footer>
    </div>
  );
}

function AppContent() {
  const [endpoint, setEndpoint] = useState(ENDPOINTS[0].url);
  const connection = new Connection(endpoint);
  const wallets = [new SolflareWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Dashboard />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function App() {
  return <AppContent />;
}