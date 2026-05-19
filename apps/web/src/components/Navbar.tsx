import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useChain } from '../context/ChainContext';
import { useTheme } from '../context/ThemeContext';
import type { ChainId } from '../lib/chains';
import { CHAIN_LIST } from '../lib/chains';

const NAV_LINKS = [
  { label: 'Home',          href: '/' },
  { label: 'Documentation', href: 'https://github.com/bastion-defend/bastion', external: true },
  { label: 'SDK',           href: '/integrate' },
  { label: 'GitHub',        href: 'https://github.com/bastion-defend', external: true },
  { label: 'Audit',         href: '/dashboard' },
];

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChainSwitcher() {
  const { chain, setChain } = useChain();
  const current = CHAIN_LIST.find((c) => c.id === chain);

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium font-sans transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        style={{ background: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
      >
        <span style={{ color: current?.color }}>{current?.icon}</span>
        <span className="hidden sm:inline">{current?.name}</span>
        <ChevronDown />
      </button>

      <div
        className="absolute right-0 mt-2 w-44 rounded-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow)' }}
      >
        {CHAIN_LIST.map((c) => (
          <button
            key={c.id}
            onClick={() => setChain(c.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-sans transition-colors duration-100 hover:opacity-80"
            style={{
              color: chain === c.id ? 'var(--text-primary)' : 'var(--text-muted)',
              background: chain === c.id ? 'var(--bg-subtle)' : 'transparent',
            }}
          >
            <span style={{ color: c.color, fontSize: '1.1em' }}>{c.icon}</span>
            <span>{c.name}</span>
            {chain === c.id && (
              <span className="ml-auto text-xs" style={{ color: c.color }}>Active</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function WalletConnect() {
  const { chain } = useChain();
  const { connected: solConnected } = useWallet();
  const { setVisible } = useWalletModal();
  const { isConnected: evmConnected } = useAccount();
  const navigate = useNavigate();

  if (chain === 'solana') {
    if (solConnected) {
      return (
        <button
          onClick={() => navigate('/dashboard')}
          className="rounded-full px-6 py-2.5 text-sm font-medium font-sans transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
        >
          Dashboard
        </button>
      );
    }
    return (
      <button
        onClick={() => setVisible(true)}
        className="rounded-full px-6 py-2.5 text-sm font-medium font-sans transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="[&_button]:!rounded-full [&_button]:!px-6 [&_button]:!py-2.5 [&_button]:!text-sm [&_button]:!font-medium [&_button]:!font-sans [&_button]:!transition-transform [&_button]:!duration-150 hover:[&_button]:!scale-[1.03] active:[&_button]:!scale-[0.98]">
      <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
    </div>
  );
}

export function Navbar() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <nav
      className="relative z-10 flex justify-between items-center px-8 py-6 max-w-7xl mx-auto"
      role="navigation"
      aria-label="Main navigation"
    >
      <Link
        to="/"
        className="text-3xl tracking-tight font-serif focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
        style={{ color: 'var(--text-primary)' }}
      >
        Bastion<sup className="text-sm align-super">®</sup>
      </Link>

      <ul className="hidden md:flex items-center gap-8 list-none m-0 p-0">
        {NAV_LINKS.map((link, i) => {
          const isFirst = i === 0;
          const linkProps = link.external
            ? { href: link.href, target: '_blank', rel: 'noopener noreferrer' }
            : {};

          return (
            <li key={link.label}>
              {link.external ? (
                <a
                  {...linkProps}
                  className="text-sm transition-colors duration-150 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
                  style={{ color: isFirst ? 'var(--text-primary)' : 'var(--text-muted)', textDecoration: 'none' }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  to={link.href}
                  className="text-sm transition-colors duration-150 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
                  style={{ color: isFirst ? 'var(--text-primary)' : 'var(--text-muted)', textDecoration: 'none' }}
                >
                  {link.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        <ChainSwitcher />
        <WalletConnect />
      </div>
    </nav>
  );
}
