import type { ChainId } from '../../lib/chains';
import { CHAINS } from '../../lib/chains';

interface Props {
  chain: ChainId;
}

const SUPPORT: Record<ChainId, { wallets: string[]; rpc: string; features: string[]; status: string }> = {
  solana: {
    wallets: ['Phantom', 'Solflare', 'Backpack'],
    rpc: 'Helius / QuickNode / Triton',
    features: [
      'Full TypeScript SDK (@bastion/sdk)',
      'On-chain audit via Anchor PDA',
      'Helius simulation integration',
      'Program allowlists',
      'Native token caps',
      'Circuit breaker',
    ],
    status: 'Production',
  },
  celo: {
    wallets: ['MetaMask', 'Rainbow', 'WalletConnect'],
    rpc: 'forno.celo.org / Infura',
    features: [
      'REST API middleware',
      'On-chain audit via EVM contract',
      'Transaction simulation',
      'Address allowlists',
      'Native token caps',
      'Circuit breaker',
      'ERC-8004 agent identity',
      'Self Protocol Agent ID',
    ],
    status: 'Beta',
  },
};

export default function ChainSupportSection({ chain }: Props) {
  const info = SUPPORT[chain];
  const config = CHAINS[chain];

  return (
    <section className="max-w-3xl mx-auto" aria-labelledby="chains-heading">
      <h3
        id="chains-heading"
        className="font-sans text-sm uppercase tracking-wider mb-4"
        style={{ color: 'var(--text-muted)' }}
      >
        Chain Support
      </h3>

      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span style={{ color: config.color, fontSize: '1.5em' }}>{config.icon}</span>
          <div>
            <h4 className="font-sans font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              {config.name}
            </h4>
            <span
              className="inline-block font-mono text-xs px-2 py-0.5 rounded-full mt-0.5"
              style={
                info.status === 'Production'
                  ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }
                  : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }
              }
            >
              {info.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <span className="font-sans text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Wallets
            </span>
            <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
              {info.wallets.join(', ')}
            </p>
          </div>
          <div>
            <span className="font-sans text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              RPC
            </span>
            <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
              {info.rpc}
            </p>
          </div>
        </div>

        <div>
          <span className="font-sans text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Features
          </span>
          <ul className="mt-2 space-y-1">
            {info.features.map((f) => (
              <li key={f} className="font-sans text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--accent)' }}>+</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
