import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches errors thrown during EVM provider initialization (wagmi / RainbowKit).
 * This most commonly happens when multiple browser wallet extensions (MetaMask,
 * Phantom, Rabby, etc.) fight over window.ethereum, leaving it in a broken state.
 *
 * When caught, the Solana side of the app is unaffected and still fully functional.
 * The user sees a non-fatal warning banner instead of a blank screen.
 *
 * Also catches the cascading viem error: "Cannot read properties of undefined
 * (reading '_bn')" which occurs when wagmi's internal transport layer receives
 * a malformed chain or a broken injected provider.
 */
export class EvmProviderErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.warn('[Bastion] EVM provider failed to initialize:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <EvmConflictBanner message={this.state.message} />
          {/* Render children WITHOUT any EVM providers.
              Hooks like useAccount will return { isConnected: false, address: undefined }.
              Solana wallet continues working normally. */}
          {this.props.children}
        </>
      );
    }
    return this.props.children;
  }
}

function EvmConflictBanner({ message }: { message: string }) {
  const isExtensionConflict =
    message.includes('ethereum') ||
    message.includes('Cannot set property') ||
    message.includes('Cannot redefine property') ||
    message.includes('getter') ||
    message.includes('_bn') ||
    message.includes('BigInt');

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#7c3aed',
        color: '#fff',
        padding: '10px 20px',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <span style={{ fontSize: '16px' }}>⚠️</span>
      <span>
        {isExtensionConflict ? (
          <>
            <strong>Wallet extension conflict detected.</strong> Multiple browser extensions
            are competing over <code>window.ethereum</code>. EVM (Celo) wallet connection
            is temporarily unavailable. To fix: disable one wallet extension and refresh,
            or use WalletConnect. Solana wallet is unaffected.
          </>
        ) : (
          <>
            <strong>EVM provider error.</strong> {message}. Solana wallet is unaffected.
          </>
        )}
      </span>
    </div>
  );
}
