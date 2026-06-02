import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAccount } from 'wagmi';
import { useChain } from '../context/ChainContext';
import { useState, useEffect, useRef } from 'react';

const PRODUCTS = [
  {
    title: 'Bastion Firewall',
    description:
      'Autonomous transaction firewall for Solana. Simulates every transaction against live chain state, enforces configurable native token caps, rate limits, program allowlists, and Daemon BlockInt security checks before signing.',
  },
  {
    title: 'Bastion Audit',
    description:
      'Immutable on chain audit trail. Every decision allowed, blocked, or pending is recorded on Solana as a verifiable record. Auditable by anyone, at any time, with full decision reasoning preserved.',
  },
  {
    title: 'Bastion Identity',
    description:
      'On chain agent identity and reputation registry. Every agent receives a Solana PDA identity with W3C DID compliance. Capability bitmaps, reputation scores, and ERC-8004 cross chain identity support.',
  },
  {
    title: 'Bastion Circuit',
    description:
      'Fleet wide circuit breaker with human override. One command pauses all transaction processing. Blocked transactions surface for human review with immutable audit trail preserved regardless of decision.',
  },
];

const FLOW_STEPS = [
  { num: '01', label: 'Define the target', desc: 'Set the policy, configure allowlists, rate limits, and security checks tailored to your agent fleet.' },
  { num: '02', label: 'Correlate across the stack', desc: 'Every transaction flows through the policy engine, blockint security checks, and Helius simulation before reaching the chain.' },
  { num: '03', label: 'Decide with evidence', desc: 'Allowed transactions execute on chain. Blocked transactions surface in the dashboard with full reasoning for human review.' },
  { num: '04', label: 'Deliver verified intelligence', desc: 'Every decision is recorded as an immutable on chain audit entry. Verifiable by regulators, auditors, and your own security team.' },
];

const TESTIMONIALS = [
  { text: 'Bastion stress-tested our automated trading agents before mainnet and caught edge cases our internal team completely missed. Thorough and fast, clearly built by people who understand Solana security.', author: 'Solana DeFi Founder', role: 'Demo partner' },
  { text: 'Bastion changed how we think about agent security. The on chain audit trail gives our compliance team exactly what OJK requires for our Indonesian exchange operations.', author: 'Crypto Exchange CTO', role: 'Enterprise partner' },
  { text: 'Really helpful for tracking agent activities in detail. Everything is laid out clearly and easy to follow. A solid tool for monitoring on chain movements.', author: 'Solana Developer', role: 'Open source user' },
  { text: 'New innovation in blockchain security monitoring. Everything is well structured and the data you get is actually useful. Way ahead of similar tools out there.', author: 'Web3 Security Researcher', role: 'Community contributor' },
];

const FAQ_ITEMS = [
  {
    q: 'What is the Bastion ecosystem?',
    a: 'Bastion is the organization behind a unified agent security platform: Bastion Firewall (transaction simulation and policy enforcement), Bastion Audit (immutable on chain audit trail), Bastion Identity (W3C DID compliant agent registry with ERC-8004 support), and Bastion Circuit (fleet wide circuit breaker with human override). Each component operates independently and shares a common intelligence layer powered by Daemon BlockInt Technologies.',
  },
  {
    q: 'Which product should I start with?',
    a: 'Start with Bastion Firewall. Integrate the TypeScript SDK into your agent, configure a policy, and begin simulating transactions against live chain state. The audit trail and identity registry activate automatically when you deploy the on chain program.',
  },
  {
    q: 'Is the stack suitable for compliance workflows?',
    a: 'Yes. Bastion aligns with SNI ISO IEC 27001 for Indonesian fintech licensing under OJK. The on chain audit trail satisfies POJK 11 of 2022 requirements for tamper proof audit logging. The W3C DID identity layer supports Indonesia Personal Data Protection Law number 27 of 2022.',
  },
  {
    q: 'How do I get access?',
    a: 'Bastion is open source under the Apache 2.0 license. Clone the repository, deploy the Solana Anchor program, start the sidecar, and integrate the SDK. For enterprise deployments and managed infrastructure, contact admin@daemonprotocol.com.',
  },
];

export default function Landing() {
  const { chain } = useChain();
  const { connected: solConnected } = useWallet();
  const { setVisible } = useWalletModal();
  const { isConnected: evmConnected } = useAccount();
  const navigate = useNavigate();
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const testimonialRef = useRef<ReturnType<typeof setInterval>>();

  const connected = chain === 'solana' ? solConnected : evmConnected;

  useEffect(() => {
    if (connected) navigate('/dashboard');
  }, [connected, navigate]);

  useEffect(() => {
    testimonialRef.current = setInterval(() => {
      setTestimonialIdx((i) => (i + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(testimonialRef.current);
  }, []);

  function handleCTA() {
    if (connected) navigate('/dashboard');
    else setVisible(true);
  }

  const baseLink = 'rounded-full px-8 py-3 text-sm font-medium font-sans transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]';
  const sectionTitle = 'font-serif text-center';
  const cardClass = 'rounded-2xl p-8 transition-all duration-300';
  const mutedText = 'font-sans text-sm leading-relaxed';

  return (
    <div className="min-h-screen w-full bg-black text-white font-sans overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5 bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
        <a href="#main-content" className="flex items-center gap-2 font-serif text-xl tracking-tight no-underline text-white">
          Bastion<span className="text-[10px] align-super ml-px">&reg;</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#products" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Products</a>
          <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">How it works</a>
          <a href="#faq" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">FAQ</a>
          <a href="#contact" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Contact</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/integrate" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Docs</Link>
          <button onClick={handleCTA} className="rounded-full bg-white text-black px-6 py-2.5 text-sm font-medium hover:bg-zinc-200 transition-colors">
            {connected ? 'Dashboard' : 'Connect Wallet'}
          </button>
        </div>
      </nav>

      <main id="main-content" className="pt-[85px]">
        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center text-center px-6 pt-32 pb-48">
          <h1
            className="font-serif max-w-4xl tracking-tight leading-[0.92]"
            style={{ fontSize: 'clamp(2.75rem, 8vw, 6rem)', letterSpacing: '-2px', fontWeight: 400 }}
          >
            Operate with<br />Clarity.
          </h1>
          <p className="font-sans mt-8 max-w-xl text-base leading-relaxed text-zinc-400">
            Daemon BlockInt Technologies builds the intelligence and security infrastructure behind on chain operations.
          </p>
          <div className="flex items-center gap-4 mt-12">
            <Link
              to="/integrate"
              className="rounded-full bg-white text-black px-14 py-4 text-base font-medium font-sans hover:bg-zinc-200 transition-colors no-underline"
            >
              Explore products
            </Link>
            <a
              href="https://github.com/bastion-agentic-defense/bastion"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-zinc-700 text-zinc-300 px-10 py-4 text-base font-medium font-sans hover:border-zinc-500 hover:text-white transition-colors no-underline"
            >
              Read docs
            </a>
          </div>
        </section>

        {/* ── Tagline marquee ── */}
        <section className="border-y border-white/[0.06] overflow-hidden py-20">
          <p
            className="font-serif text-center max-w-3xl mx-auto px-6 leading-[1.15] text-zinc-400"
            style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', fontWeight: 400 }}
          >
            The onchain world grew faster than the infrastructure built to protect it. Intelligence, security,
            reconnaissance, and execution ended up in separate tools, separate vendors, separate contexts.
            Daemon BlockInt Technologies was built because that gap has a cost and no one was closing it as a coherent system.
          </p>
          <p className="font-serif text-center mt-8 text-white" style={{ fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 400, lineHeight: '1.15' }}>
            We exist to give onchain operators<br />the full picture, in one place, before it matters.
          </p>
        </section>

        {/* ── Products ── */}
        <section id="products" className="max-w-6xl mx-auto px-6 py-32">
          <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">Safe. Modular. Connected.</p>
          <p className="font-sans text-base text-zinc-400 max-w-lg mb-16 leading-relaxed">
            Each product was built to solve a distinct operational problem. Deploy one or all of them. They work independently and together.
          </p>

          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
              {PRODUCTS.map((product, i) => (
                <div
                  key={product.title}
                  className={`${cardClass} flex-shrink-0 w-[340px] snap-center`}
                  style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="font-mono text-xs text-zinc-600 mb-6 block">/{i === 0 ? '0.1' : i === 1 ? '0.2' : i === 2 ? '0.3' : '0.4'}</span>
                  <h3 className="font-serif text-xl mb-4 tracking-tight" style={{ fontWeight: 400, letterSpacing: '-0.5px' }}>
                    {product.title}
                  </h3>
                  <p className={`${mutedText} text-zinc-400`}>{product.description}</p>
                </div>
              ))}
            </div>

            {/* Carousel indicators */}
            <div className="flex gap-2 justify-center mt-6">
              {PRODUCTS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const el = document.querySelector('#products .snap-x');
                    if (el) el.scrollTo({ left: i * 356, behavior: 'smooth' });
                  }}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ background: i === 0 ? '#fff' : 'rgba(255,255,255,0.15)' }}
                  aria-label={`Product ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-32">
          <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">How it works</p>
          <h2 className="font-sans text-2xl font-medium mb-20">One workflow. Four steps. No context switching.</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FLOW_STEPS.map((step) => (
              <div key={step.num}>
                <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center font-mono text-xs text-zinc-500 mb-6">
                  {step.num}
                </div>
                <h3 className="font-sans font-medium text-sm mb-3">{step.label}</h3>
                <p className="font-sans text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Social proof ── */}
        <section className="border-t border-white/[0.06] py-32">
          <div className="max-w-4xl mx-auto px-6">
            <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">Social proof</p>
            <h2 className="font-sans text-2xl font-medium mb-20">Trusted by the teams building onchain.</h2>

            <div className="relative min-h-[120px]">
              {TESTIMONIALS.map((t, i) => (
                <blockquote
                  key={i}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: i === testimonialIdx ? 1 : 0, pointerEvents: i === testimonialIdx ? 'auto' : 'none' }}
                >
                  <p className="font-serif text-lg leading-relaxed mb-6" style={{ letterSpacing: '-0.3px', fontWeight: 400 }}>
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <footer>
                    <cite className="font-sans text-sm not-italic text-zinc-300 block">{t.author}</cite>
                    <span className="font-sans text-xs text-zinc-500">{t.role}</span>
                  </footer>
                </blockquote>
              ))}
            </div>

            <div className="flex gap-2 mt-10">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTestimonialIdx(i)}
                  className="w-2 h-2 rounded-full transition-colors"
                  style={{ background: i === testimonialIdx ? '#fff' : 'rgba(255,255,255,0.15)' }}
                  aria-label={`Testimonial ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="max-w-3xl mx-auto px-6 py-32">
          <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">FAQs</p>
          <div className="space-y-1">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border-b border-white/[0.06]">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left font-sans text-sm font-medium hover:text-zinc-300 transition-colors"
                  aria-expanded={openFaq === i}
                >
                  <span>{item.q}</span>
                  <span className={`text-zinc-500 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: openFaq === i ? '500px' : '0', opacity: openFaq === i ? 1 : 0 }}
                >
                  <p className="font-sans text-sm text-zinc-400 pb-5 leading-relaxed">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact" className="max-w-3xl mx-auto px-6 pb-20">
          <p className="font-sans text-sm uppercase tracking-widest text-zinc-500 mb-4">Work with Daemon.</p>
          <p className="font-sans text-base text-zinc-400 mb-8 leading-relaxed">
            Enterprise deployments, technical evaluations, or general inquiries reach us directly.
          </p>
          <a
            href="mailto:admin@daemonprotocol.com?subject=Bastion%20%E2%80%94%20Enterprise%20Inquiry"
            className="inline-flex rounded-full bg-white text-black px-10 py-4 text-sm font-medium font-sans hover:bg-zinc-200 transition-colors no-underline"
          >
            Get in Touch
          </a>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/[0.06] py-16">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-12">
            <div className="flex flex-col gap-6">
              <a href="#main-content" className="font-serif text-xl tracking-tight no-underline text-white">
                Bastion<span className="text-[10px] align-super ml-px">&reg;</span>
              </a>
              <div className="flex gap-4">
                <a href="https://www.linkedin.com/company/daemonprotocol/about/" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors text-sm no-underline">LinkedIn</a>
                <a href="https://x.com/DaemonProtocol" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors text-sm no-underline">X</a>
              </div>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-zinc-600 mb-4">Company</p>
              <div className="flex flex-col gap-3">
                <a href="#products" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Products</a>
                <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">How it works</a>
                <a href="#faq" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">FAQ</a>
                <a href="#contact" className="text-sm text-zinc-400 hover:text-white transition-colors no-underline">Contact</a>
              </div>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-zinc-600 mb-4">Products</p>
              <div className="flex flex-col gap-3">
                <span className="text-sm text-zinc-400">Bastion Firewall</span>
                <span className="text-sm text-zinc-400">Bastion Audit</span>
                <span className="text-sm text-zinc-400">Bastion Identity</span>
                <span className="text-sm text-zinc-400">Bastion Circuit</span>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-6 mt-12 pt-8 border-t border-white/[0.06]">
            <p className="font-sans text-xs text-zinc-600">&copy; 2026 Daemon Protocol. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
