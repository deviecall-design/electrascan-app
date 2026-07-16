import React from 'react';
import {
  Ruler,
  Calculator,
  ListChecks,
  Send,
  PackageCheck,
  FunctionSquare,
  Truck,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useReveal } from '@/hooks/useReveal';

interface LandingPageProps {
  onEnterApp: () => void;
}

// ─── Reveal wrapper ─────────────────────────────────────────
// Thin wrapper around useReveal so sections opt into the scroll-lift
// without repeating the ref/data-attribute plumbing everywhere.
const Reveal: React.FC<{ children: React.ReactNode; className?: string; delayMs?: number }> = ({
  children,
  className,
  delayMs = 0,
}) => {
  const { ref, playing } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`ds-reveal ${playing ? 'ds-reveal-play' : ''} ${className ?? ''}`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
};

// This page's own client-side router (see components/Router.tsx) listens
// globally for `hashchange` and reinterprets ANY URL hash as a route,
// falling back to the dashboard for anything it doesn't recognize. Plain
// `<a href="#loop">` in-page anchors collide with that: the browser sets
// the hash, the router's listener fires, doesn't recognize "#loop" as a
// route, and force-navigates to the dashboard instead of scrolling.
// Section jumps here must go through scrollIntoView and never touch
// location.hash. (The "Explore the app" CTAs are unaffected — "#/" IS a
// real route, so letting the router handle it is correct there.)
function scrollToSection(id: string) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
}

// ─── Nav ─────────────────────────────────────────────────────
const LandingNav: React.FC<{ onEnterApp: () => void }> = ({ onEnterApp }) => (
  <header className="sticky top-0 z-10 border-b border-hairline-brand/70 bg-white/80 backdrop-blur-md">
    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
      <div className="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md" />
        <span className="text-base font-semibold tracking-tight text-ink">ElectraScan</span>
      </div>
      <nav className="hidden items-center gap-6 sm:flex">
        <button
          onClick={() => scrollToSection('loop')}
          className="rounded-sm text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdigris"
        >
          How it works
        </button>
        <button
          onClick={() => scrollToSection('features')}
          className="rounded-sm text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdigris"
        >
          Features
        </button>
        <button
          onClick={() => scrollToSection('faq')}
          className="rounded-sm text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdigris"
        >
          FAQ
        </button>
      </nav>
      <a
        href="#/"
        onClick={onEnterApp}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-verdigris px-4 text-sm font-medium text-white transition-colors hover:bg-verdigris-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdigris"
      >
        Explore the app
      </a>
    </div>
  </header>
);

// ─── Hero ────────────────────────────────────────────────────
// A miniature, illustrative mockup of the app's own light UI, floating over
// the hero's dark verdigris band. Deliberately schematic (not a real
// screenshot) — the micro text sizes below are the mockup's own "at 20%
// scale" chrome, not marketing copy, so they sit off the page type ramp
// on purpose.
const HeroMockup: React.FC = () => (
  <div className="relative w-full max-w-md rounded-xl bg-white p-3 shadow-[0_24px_60px_-16px_rgba(8,30,35,0.45)] sm:max-w-lg">
    <div className="mb-2.5 flex items-center gap-2 rounded-t-md px-1.5 py-1">
      <span className="h-2.5 w-2.5 rounded-full bg-hairline-brand" />
      <span className="h-2.5 w-2.5 rounded-full bg-hairline-brand" />
      <span className="h-2.5 w-2.5 rounded-full bg-hairline-brand" />
      <span className="ml-2 truncate text-xs font-medium text-ink-muted">
        Kitchen Renovation — Level 1.pdf
      </span>
    </div>

    <div className="flex gap-3">
      {/* Fake sidebar */}
      <div className="hidden w-28 shrink-0 space-y-1.5 rounded-lg bg-panel-sunken p-2 sm:block">
        {[
          { label: '24× GPO', dot: 'bg-verdigris' },
          { label: '10× Downlight', dot: 'bg-amber-signal' },
          { label: '2× Switchboard', dot: 'bg-success-brand' },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
            <span className="truncate text-[0.65rem] font-medium text-ink">{row.label}</span>
          </div>
        ))}
      </div>

      {/* Fake takeoff canvas */}
      <div className="relative flex-1 overflow-hidden rounded-lg bg-panel">
        <svg viewBox="0 0 200 160" className="h-full w-full" aria-hidden="true">
          <rect x="1" y="1" width="198" height="158" rx="6" fill="none" stroke="oklch(0.90 0.008 180)" strokeWidth="1" />
          <path
            d="M20 20 H140 V70 H180 V140 H60 V100 H20 Z"
            fill="none"
            stroke="oklch(0.52 0.014 180)"
            strokeWidth="1.5"
          />
          <circle cx="40" cy="35" r="4" fill="oklch(0.42 0.095 180)" />
          <circle cx="100" cy="35" r="4" fill="oklch(0.42 0.095 180)" />
          <circle cx="160" cy="90" r="4" fill="oklch(0.42 0.095 180)" />
          <rect x="72" y="112" width="14" height="10" rx="1.5" fill="oklch(0.72 0.16 75)" />
        </svg>

        {/* Floating estimate chip */}
        <div className="absolute bottom-2 right-2 rounded-md bg-white px-2.5 py-1.5 shadow-md ring-1 ring-black/5">
          <p className="text-[0.6rem] font-medium uppercase tracking-wide text-ink-muted">Estimate</p>
          <p className="text-xs font-semibold text-ink">$18,240.00</p>
        </div>
      </div>
    </div>
  </div>
);

const Hero: React.FC<{ onEnterApp: () => void }> = ({ onEnterApp }) => (
  <section
    className="relative overflow-hidden bg-verdigris px-6 py-20 sm:py-28"
    style={{
      // A single, deliberate gradient within the verdigris hue family (a
      // gradient stop, not a second brand color) for atmospheric depth —
      // never applied to text, per the gradient-text ban.
      backgroundImage:
        'radial-gradient(120% 100% at 15% 0%, oklch(0.48 0.09 178) 0%, oklch(0.42 0.095 180) 55%, oklch(0.34 0.075 180) 100%)',
    }}
  >
    <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
      <div>
        <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.25rem]">
          From blueprint to bid to order — without leaving the plan.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80">
          ElectraScan measures your PDF plans, prices the job, and carries the
          bill of materials straight through to a wholesaler order. One tool,
          the whole loop — no spreadsheets, no re-keying quantities twice.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a
            href="#/"
            onClick={onEnterApp}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-amber-signal px-6 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore the app
            <ArrowRight className="size-4" />
          </a>
          <span className="text-sm text-white/75">Free to try — no signup required.</span>
        </div>
      </div>

      <div className="flex justify-center lg:justify-end">
        <HeroMockup />
      </div>
    </div>
  </section>
);

// ─── Bid-to-order loop ───────────────────────────────────────
// A genuine chronological sequence (each step depends on the last), so
// numbering it is earned — see impeccable's numbered-eyebrow ban, which
// this is deliberately not: it's the only numbered sequence on the page.
const LOOP_STEPS = [
  {
    icon: Ruler,
    title: 'Measure the plan',
    body: 'Trace outlets, circuits, and fixtures directly on the PDF, calibrated to scale.',
  },
  {
    icon: Calculator,
    title: 'Price it instantly',
    body: 'Assemblies turn quantities into labor and material costs the moment you draw.',
  },
  {
    icon: ListChecks,
    title: 'Generate the BOM',
    body: 'Every line item rolls up into a clean, wholesaler-ready bill of materials.',
  },
  {
    icon: Send,
    title: 'Send it for pricing',
    body: 'The BOM goes straight to your wholesaler for a real, current quote.',
  },
  {
    icon: PackageCheck,
    title: 'Track it to delivery',
    body: 'Follow the order status until the materials land on site.',
  },
] as const;

const LoopSection: React.FC = () => (
  <section id="loop" className="scroll-mt-16 px-6 py-24 sm:py-28">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-ink">
          The five-step loop that ends at a delivered order.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
          Most estimating tools stop at a printed quote. ElectraScan keeps going.
        </p>
      </Reveal>

      <div className="relative mt-16 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-y-0">
        {/* Connecting line (desktop only) */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-hairline-brand lg:block"
          aria-hidden="true"
        />

        {LOOP_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <Reveal key={step.title} delayMs={i * 90} className="relative">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-verdigris text-sm font-semibold text-white">
                {i + 1}
              </div>
              <Icon className="mt-4 size-5 text-verdigris" />
              <h3 className="mt-3 text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </Reveal>
          );
        })}
      </div>
    </div>
  </section>
);

// ─── Feature highlights (asymmetric, not a uniform card grid) ──
const SECONDARY_FEATURES = [
  {
    icon: FunctionSquare,
    title: 'Smart assemblies & formulas',
    body: 'Build a "Wall" assembly once; it calculates studs, cable, and switches automatically from a single measurement.',
  },
  {
    icon: Truck,
    title: 'Wholesaler ordering, built in',
    body: 'The BOM goes to your wholesaler from the same screen you built the estimate — no re-typing quantities into an email.',
  },
  {
    icon: FileText,
    title: 'Reports that plug into your books',
    body: 'Client-ready PDF proposals and Excel/CSV exports that connect straight to your existing accounting.',
  },
] as const;

const FeaturesSection: React.FC = () => (
  <section id="features" className="scroll-mt-16 border-t border-hairline-brand bg-panel px-6 py-24 sm:py-28">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-ink">
          Built around how electricians actually take off a job.
        </h2>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {/* Featured, larger item — deliberately asymmetric against the
            lighter-weight rows on the right, instead of four equal cards. */}
        <Reveal className="flex flex-col justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-verdigris/10">
            <Ruler className="size-5 text-verdigris" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-ink">PDF takeoff & measurement</h3>
          <p className="mt-2.5 max-w-md text-base leading-relaxed text-ink-muted">
            Pixel-accurate area, linear, and count takeoffs calibrated to your
            plan's exact scale, with pan, zoom, and snap-to-line precision on
            drawing sets over a hundred pages deep.
          </p>
        </Reveal>

        {/* Lighter-weight rows — dividers, not cards. */}
        <div className="divide-y divide-hairline-brand">
          {SECONDARY_FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delayMs={i * 80} className="flex gap-4 py-6 first:pt-0 last:pb-0">
                <Icon className="mt-0.5 size-5 shrink-0 text-verdigris" />
                <div>
                  <h3 className="text-base font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

// ─── FAQ ─────────────────────────────────────────────────────
// Deliberately no pricing question: there's no public price yet, and
// inventing one would repeat the exact overpromise the CTA copy was
// just fixed for. Every answer below is true of the app as it ships
// today — nothing aspirational.
const FAQ_ITEMS = [
  {
    question: 'Do I need to install anything?',
    answer: 'No — ElectraScan runs in your browser. Open it and start a takeoff.',
  },
  {
    question: 'What file types can I take off?',
    answer: 'PDF plans. Upload a set and start measuring to scale, page by page.',
  },
  {
    question: 'How does wholesaler ordering work?',
    answer:
      'Once your bill of materials is ready, send it straight to your wholesaler for pricing from inside ElectraScan — no re-typing quantities into an email.',
  },
  {
    question: 'Do I need a credit card to try it?',
    answer: 'No — explore the app free, no signup required right now.',
  },
] as const;

const FaqSection: React.FC = () => (
  <section id="faq" className="scroll-mt-16 border-t border-hairline-brand px-6 py-24 sm:py-28">
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-ink">
          Questions, answered plainly.
        </h2>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-x-16 gap-y-10 sm:grid-cols-2">
        {FAQ_ITEMS.map((item, i) => (
          <Reveal key={item.question} delayMs={i * 70}>
            <h3 className="text-base font-semibold text-ink">{item.question}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.answer}</p>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

// ─── Closing CTA ─────────────────────────────────────────────
const ClosingCta: React.FC<{ onEnterApp: () => void }> = ({ onEnterApp }) => (
  <section className="px-6 py-24 sm:py-28">
    <Reveal className="mx-auto flex max-w-3xl flex-col items-start gap-6 rounded-2xl bg-verdigris px-8 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-12">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white">
          See ElectraScan on your next bid.
        </h2>
        <p className="mt-2 text-sm text-white/75">Free to try — no signup required.</p>
      </div>
      <a
        href="#/"
        onClick={onEnterApp}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-amber-signal px-6 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Explore the app
        <ArrowRight className="size-4" />
      </a>
    </Reveal>
  </section>
);

// ─── Footer ──────────────────────────────────────────────────
// Intentionally minimal — no Product/Pricing/Company link columns, since
// those pages don't exist yet. Fabricating a footer nav would be worse
// than a short one, per PRODUCT.md's honesty bar on unproven content.
const LandingFooter: React.FC = () => (
  <footer className="border-t border-hairline-brand px-6 py-10">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
      <div className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-5 w-5 rounded" />
        <span className="text-sm font-semibold text-ink">ElectraScan</span>
      </div>
      <p className="text-xs text-ink-muted">
        © {new Date().getFullYear()} ElectraScan. Estimating software for electrical contractors.
      </p>
    </div>
  </footer>
);

// ─── Page ────────────────────────────────────────────────────
const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => (
  <div className="h-screen w-full overflow-y-auto bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
    <LandingNav onEnterApp={onEnterApp} />
    <main>
      <Hero onEnterApp={onEnterApp} />
      <LoopSection />
      <FeaturesSection />
      <FaqSection />
      <ClosingCta onEnterApp={onEnterApp} />
    </main>
    <LandingFooter />
  </div>
);

export default LandingPage;
