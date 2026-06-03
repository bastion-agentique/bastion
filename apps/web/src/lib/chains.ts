export type ChainId = 'solana' | 'evm';

export interface ChainConfig {
  id: ChainId;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  rpcUrl: string;
  explorerUrl: string;
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    shortName: 'SOL',
    icon: '◎',
    color: '#9945FF',
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com',
  },
  evm: {
    id: 'evm',
    name: 'EVM (Celo/Base/Polygon)',
    shortName: 'EVM',
    icon: '⟠',
    color: '#6B7280',
    rpcUrl: '',
    explorerUrl: '',
  },
};

export const CHAIN_LIST: ChainConfig[] = Object.values(CHAINS);
export const DEFAULT_CHAIN: ChainId = 'solana';
