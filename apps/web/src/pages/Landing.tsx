import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { useChain } from '../context/ChainContext';
import { useState, useEffect } from 'react';

const FEATURES = [
  {
    title: 'Bastion Firewall',
    description: 'Autonomous transaction firewall for Solana. Simulates every transaction against live chain state, enforces configurable native token caps, rate limits, program allowlists, and Daemon BlockInt security checks before signing. Fleet-wide circuit breaker pauses all processing with one command.',
  },
  {
    title: 'Bastion Audit',
    description: 'Immutable on chain audit trail. Every decision allowed, blocked, or pending is recorded on Solana as a verifiable record. Auditable by anyone, at any time, with full decision reasoning preserved.',
  },
  {
    title: 'Bastion Identity',
    description: 'On chain agent identity and reputation registry on Solana. Every agent receives a unique PDA identity with verifiable metadata. Reputation accrues in real time, enabling trust-gated marketplaces, agent scoring, and portable identity across the Solana ecosystem.',
  },
];

function FeaturesCarousel() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-6 py-32">
      <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">Safe. Modular. Connected.</p>
      <p className="font-sans text-base text-zinc-400 max-w-lg mb-16 leading-relaxed">
        Each feature was built to solve a distinct operational problem. Deploy one or all of them. They work independently and together.
      </p>

      <div
        className="gap-5"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}
      >
        {FEATURES.map((feature, i) => (
          <div
            key={feature.title}
            className="animate-fade-rise rounded-2xl p-8 transition-all duration-500 hover:scale-[1.02] hover:border-white/15 group cursor-default"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.06)',
              animationDelay: `${i * 150}ms`,
              animationFillMode: 'both',
            }}
          >
            <span className="font-mono text-xs text-zinc-600 mb-6 block transition-colors duration-300 group-hover:text-zinc-400">/0.{i + 1}</span>
              <h3 className="font-serif text-xl mb-4 tracking-tight transition-colors duration-300 group-hover:text-white" style={{ fontWeight: 400, letterSpacing: '-0.5px' }}>{feature.title}</h3>
              <p className="font-sans text-sm leading-relaxed text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FLOW_STEPS = [
  { num: '01', label: 'Define the target', desc: 'Set the policy, configure allowlists, rate limits, and security checks tailored to your agent fleet.' },
  { num: '02', label: 'Correlate across the stack', desc: 'Every transaction flows through the policy engine, blockint security checks, and Helius simulation before reaching the chain.' },
  { num: '03', label: 'Decide with evidence', desc: 'Allowed transactions execute on chain. Blocked transactions surface in the dashboard with full reasoning for human review.' },
  { num: '04', label: 'Deliver verified intelligence', desc: 'Every decision is recorded as an immutable on chain audit entry. Verifiable by regulators, auditors, and your own security team.' },
];

const FAQ_ITEMS = [
  {
    q: 'What is the Bastion ecosystem?',
    a: 'Bastion is a unified agent security platform built on Daemon BlockInt Technologies. It includes Bastion Firewall (transaction simulation and policy enforcement), Bastion Audit (immutable on chain audit trail), Bastion Identity (Solana native agent identity and reputation registry with W3C DID compliance), and Bastion Circuit (fleet wide circuit breaker with human override). Each component operates independently and shares a common intelligence layer powered by Daemon BlockInt Technologies.',
  },
  {
    q: 'Which product should I start with?',
    a: 'Start with Bastion Firewall. Integrate the TypeScript SDK into your agent, configure a policy, and begin simulating transactions against live chain state. The audit trail and identity registry activate automatically when you deploy the on chain program.',
  },
  {
    q: 'How does Daemon BlockInt intelligence power Bastion?',
    a: 'Daemon BlockInt Technologies provides three core assets. GrondOSINT feeds real world threat data into Bastion risk oracle querying Tavily for web search and Shodan for internet infrastructure. The Blockint rules engine detects flash loans, high slippage, authority changes, and risk labeled addresses. The 47 agent skills ecosystem covers blockchain forensics, compliance workflows, and DeFi security auditing. All three pipelines power Bastion security checks before any transaction reaches the chain.',
  },
  {
    q: 'How do I get access?',
    a: 'Bastion is open source under the Apache 2.0 license. Clone the repository at github.com slash bastion agentic defense slash bastion, deploy the Solana Anchor program, start the sidecar, and integrate the SDK. For enterprise deployments and managed infrastructure, contact admin at daemonprotocol dot com.',
  },
];

export default function Landing() {
  const { chain } = useChain();
  const { connected: solConnected } = useWallet();
  const { setVisible } = useWalletModal();
  const { isConnected: evmConnected } = useAccount();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const connected = chain === 'solana' ? solConnected : evmConnected;

  useEffect(() => {
    if (connected) navigate('/dashboard');
  }, [connected, navigate]);

  function handleCTA() {
    if (connected) navigate('/dashboard');
    else setVisible(true);
  }

  return (
    <div className="min-h-screen w-full bg-black text-white font-sans overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5 bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
        <a href="#main-content" className="flex items-center gap-2 font-serif text-xl tracking-tight no-underline text-white">
          Bastion<span className="text-[10px] align-super ml-px">&reg;</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Features</a>
          <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">How it works</a>
          <a href="#faq" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">FAQ</a>
          <a href="#contact" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Contact</a>
        </div>
        <button onClick={handleCTA} className="rounded-full bg-white text-black px-6 py-2.5 text-sm font-medium hover:bg-zinc-200 transition-colors">
          {connected ? 'Dashboard' : 'Connect Wallet'}
        </button>
      </nav>

      <main id="main-content" className="pt-[85px]">
        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center text-center px-6 pt-32 pb-48">
          <h1
            className="font-serif max-w-4xl tracking-tight leading-[0.95]"
            style={{ fontSize: 'clamp(2.75rem, 8vw, 5.5rem)', letterSpacing: '-2px', fontWeight: 400 }}
          >
            Trust your Agent,<br />Verify every Transaction.
          </h1>
          <p className="font-sans mt-8 max-w-xl text-base leading-relaxed text-zinc-400">
            Building infrastructure for brilliant agents, fearless developers, and decentralized protocols. Through the noise, we craft a firewall for pure execution.
          </p>
          <div className="flex items-center gap-4 mt-12">
            <Link
              to="/integrate"
              className="rounded-full bg-white text-black px-14 py-4 text-base font-medium font-sans hover:bg-zinc-200 transition-colors no-underline"
            >
              Integrate your agent
            </Link>
            <a
              href="https://github.com/bastion-agentic-defense/bastion"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-zinc-700 text-zinc-300 px-10 py-4 text-base font-medium font-sans hover:border-zinc-500 hover:text-white transition-colors no-underline"
            >
              GitHub
            </a>
          </div>
        </section>

        {/* ── Tagline ── */}
        <section className="border-y border-white/[0.06] overflow-hidden py-20">
          <p
            className="font-serif text-center max-w-3xl mx-auto px-6 leading-[1.15] text-zinc-400"
            style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', fontWeight: 400 }}
          >
            Powered by Daemon BlockInt Technologies. The onchain world grew faster than the
            infrastructure built to protect it. Intelligence, security, and execution ended up in
            separate tools, separate vendors, separate contexts. Bastion was built because that gap
            has a cost and no one was closing it as a coherent system.
          </p>
          <p className="font-serif text-center mt-8 text-white" style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 400, lineHeight: '1.15' }}>
            The first SIEM where the audit trail<br />itself is the product.
          </p>
        </section>

        {/* ── Features ── */}
        <FeaturesCarousel />

        {/* ── How it works ── */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-32">
          <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">How it works</p>
          <h2 className="font-sans text-2xl font-medium mb-20">One workflow. Four steps. No context switching.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FLOW_STEPS.map((step) => (
              <div key={step.num}>
                <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center font-mono text-xs text-zinc-500 mb-6">{step.num}</div>
                <h3 className="font-sans font-medium text-sm mb-3">{step.label}</h3>
                <p className="font-sans text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="max-w-3xl mx-auto px-6 py-32">
          <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">FAQs</p>
          <div className="space-y-1">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border-b border-white/[0.06]">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between py-5 text-left font-sans text-sm font-medium hover:text-zinc-300 transition-colors" aria-expanded={openFaq === i}>
                  <span>{item.q}</span>
                  <span className={`text-zinc-500 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: openFaq === i ? '600px' : '0', opacity: openFaq === i ? 1 : 0 }}>
                  <p className="font-sans text-sm text-zinc-400 pb-5 leading-relaxed">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact" className="max-w-3xl mx-auto px-6 pb-20">
          <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">Work with Bastion.</p>
          <p className="font-sans text-base text-zinc-400 mb-8 leading-relaxed">
            Enterprise deployments, technical evaluations, or general inquiries reach us directly.
          </p>
          <a href="mailto:admin@daemonprotocol.com?subject=Bastion%20%E2%80%94%20Enterprise%20Inquiry" className="inline-flex rounded-full bg-white text-black px-10 py-4 text-sm font-medium font-sans hover:bg-zinc-200 transition-colors no-underline">
            Get in Touch
          </a>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/[0.06] py-16">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-12">
            <div className="flex flex-col gap-6">
              <a href="#main-content" className="font-serif text-xl tracking-tight no-underline text-white">Bastion<span className="text-[10px] align-super ml-px">&reg;</span></a>
              <p className="font-sans text-xs text-zinc-600 max-w-xs leading-relaxed">Built on Daemon BlockInt Technologies. The first SIEM where the audit trail itself is the product.</p>
              <div className="flex gap-4">
                <a href="https://github.com/bastion-agentic-defense/bastion" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors text-sm no-underline">GitHub</a>
                <a href="https://x.com/DaemonProtocol" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors text-sm no-underline">X</a>
              </div>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-zinc-600 mb-4">Company</p>
              <div className="flex flex-col gap-3">
          <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Features</a>
                <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">How it works</a>
                <a href="#faq" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">FAQ</a>
                <a href="#contact" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Contact</a>
              </div>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-zinc-600 mb-4">Features</p>
              <div className="flex flex-col gap-3">
                <span className="text-sm text-zinc-400">Bastion Firewall</span>
                <span className="text-sm text-zinc-400">Bastion Audit</span>
                <span className="text-sm text-zinc-400">Bastion Identity</span>
                <span className="text-sm text-zinc-400">Bastion Circuit</span>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-6 mt-12 pt-8 border-t border-white/[0.06]">
            <p className="font-sans text-xs text-zinc-600">&copy; 2026 Bastion. Built on Daemon BlockInt Technologies. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
