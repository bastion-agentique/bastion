import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';

const FEATURES = [
  {
    title: 'ZK-Private Policy Engine',
    description:
      'Policy contents never touch the chain in plain text. Every rule is committed as a Compact circuit hash. Only the compliance decision is revealed.',
    tag: 'Core',
  },
  {
    title: 'On-Chain Audit Trail',
    description:
      'Every allow and block decision is recorded as an immutable ZK commitment on Midnight. Verifiable without revealing agent identity, target address, or transaction value.',
    tag: 'Unique',
  },
  {
    title: 'Agent Identity Registry',
    description:
      'Every AI agent gets a ZK commitment identity on Midnight. The real address is never stored on-chain. Reputation compounds across sessions without leaking activity.',
    tag: 'Unique',
  },
  {
    title: 'Selective Disclosure',
    description:
      'Audit entries can be cryptographically revealed to authorized auditors on demand. No blanket exposure. Compliance proofs are generated per-request.',
    tag: 'Privacy',
  },
  {
    title: 'Circuit Breaker',
    description:
      'One command pauses all transaction processing across your agent fleet. Emergency stop backed by an on-chain Compact circuit. Resumes instantly.',
    tag: 'Safety',
  },
  {
    title: 'Human Override',
    description:
      'Blocked transactions surface in the dashboard for human review. Approve or reject with one click. Audit commitment preserved regardless of the decision.',
    tag: 'Control',
  },
];

const TAG_COLORS: Record<string, string> = {
  Core:    'bg-violet-500/10 text-violet-400 border border-violet-500/20',
  Unique:  'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  Privacy: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  Safety:  'bg-red-500/10 text-red-400 border border-red-500/20',
  Control: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
};

const FLOW_STEPS = [
  { label: 'AI Agent',  sub: 'Constructs transaction' },
  { label: 'Bastion',   sub: 'Policy + ZK proof check' },
  { label: 'Midnight',  sub: 'Commitment recorded on-chain' },
  { label: 'Target',    sub: 'Transaction executed' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Navbar ── */}
      <Navbar />

      {/* ── Hero Section ── */}
      <section
        className="relative z-10 flex flex-col items-center justify-center text-center px-6 pb-40"
        style={{ paddingTop: 'calc(8rem - 75px)' }}
        aria-labelledby="hero-headline"
      >
        <h1
          id="hero-headline"
          className="animate-fade-rise font-serif max-w-5xl"
          style={{
            fontSize: 'clamp(2.75rem, 8vw, 5.5rem)',
            lineHeight: '0.95',
            letterSpacing: '-2.46px',
            fontWeight: 400,
            color: 'var(--text-primary)',
          }}
        >
          Beyond security,{' '}
          <em style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>we build</em>{' '}
          the verifiable.
        </h1>

        <p
          className="animate-fade-rise-delay font-sans mt-8 max-w-2xl text-base sm:text-lg leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          A ZK-private firewall for autonomous AI agents. Policy enforcement, identity, and audit
          — all on Midnight Network. Your agents act. No one learns what they did.
        </p>

        <button
          onClick={() => navigate('/dashboard')}
          className="animate-fade-rise-delay-2 mt-12 rounded-full px-14 py-5 text-base font-medium font-sans transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
        >
          Open Dashboard
        </button>
      </section>

      {/* ── Architecture Flow ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24" aria-label="How Bastion works">
        <h2
          className="font-serif text-center mb-16"
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            letterSpacing: '-1px',
            fontWeight: 400,
            color: 'var(--text-primary)',
          }}
        >
          How it works
        </h2>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-0">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.label} className="flex flex-col sm:flex-row items-center">
              {/* Step box */}
              <div
                className="flex flex-col items-center text-center px-6 py-4 rounded-xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', minWidth: '140px' }}
              >
                <span className="font-sans font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {step.label}
                </span>
                <span className="font-sans text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {step.sub}
                </span>
              </div>

              {/* Arrow */}
              {i < FLOW_STEPS.length - 1 && (
                <div
                  className="w-8 h-px sm:h-px sm:w-8 my-2 sm:my-0 sm:mx-1 flex-shrink-0"
                  style={{ background: 'var(--border)' }}
                  aria-hidden="true"
                >
                  <span className="sr-only">to</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bento Feature Grid ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-40" aria-labelledby="features-heading">
        <h2
          id="features-heading"
          className="font-serif text-center mb-16"
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            letterSpacing: '-1px',
            fontWeight: 400,
            color: 'var(--text-primary)',
          }}
        >
          Every layer, defended.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="group relative rounded-2xl p-6 transition-shadow duration-200"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <h3
                  className="font-sans font-semibold text-base pr-4"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {feature.title}
                </h3>
                <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${TAG_COLORS[feature.tag]}`}>
                  {feature.tag}
                </span>
              </div>
              <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="relative z-10 flex flex-col items-center text-center px-6 pb-32"
        aria-label="Call to action"
      >
        <h2
          className="font-serif max-w-2xl"
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            letterSpacing: '-1px',
            fontWeight: 400,
            color: 'var(--text-primary)',
          }}
        >
          Your agents deserve a firewall.
        </h2>
        <p
          className="font-sans mt-4 max-w-md text-base leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          Open source. MIT licensed. Built on Midnight Network.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-8 rounded-full px-12 py-4 text-base font-medium font-sans transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
        >
          Open Dashboard
        </button>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 border-t px-8 py-8 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="font-serif text-xl" style={{ color: 'var(--text-primary)' }}>
          Bastion<sup className="text-xs align-super">®</sup>
        </span>
        <span className="font-sans text-sm" style={{ color: 'var(--text-muted)' }}>
          Bastion v0.1.0 — ZK-Private AI Agent Firewall for Midnight Network
        </span>
        <a
          href="https://github.com/bastion-defend/midnight-bastion"
          target="_blank"
          rel="noopener noreferrer"
          className="font-sans text-sm transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          style={{ color: 'var(--text-muted)', opacity: 0.7 }}
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
