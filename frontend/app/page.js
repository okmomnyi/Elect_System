import Link from 'next/link';

const features = [
  {
    icon: 'lock',
    title: 'End-to-End Secure',
    body: 'RS256 JWT authentication, encrypted ballots, and zero-knowledge vote separation ensure your identity never touches your choice.',
  },
  {
    icon: 'visibility_off',
    title: 'Ballot Secrecy',
    body: 'Who voted and how they voted are stored in separate tables with no join possible — cryptographic anonymity by design.',
  },
  {
    icon: 'monitoring',
    title: 'Live Results',
    body: 'Real-time WebSocket tallies the moment polls close, broadcast instantly to every connected device on campus.',
  },
  {
    icon: 'receipt_long',
    title: 'Verifiable Receipt',
    body: 'Each voter receives a cryptographic receipt token they can use to confirm their ballot was included — without revealing their choice.',
  },
  {
    icon: 'history',
    title: 'Full Audit Trail',
    body: 'Every administrative action is logged with timestamp, IP, and actor — complete transparency for election commissioners.',
  },
  {
    icon: 'speed',
    title: 'University-Scale',
    body: 'BullMQ async queue, Redis tally, and RabbitMQ vote processing handle thousands of concurrent votes without a miss.',
  },
];

const steps = [
  { num: '01', title: 'Verify your university email',  body: 'Enter your @university.edu address — a 6-digit OTP is sent within seconds.' },
  { num: '02', title: 'Browse open elections',         body: 'See every active ballot, candidate profiles, and the poll close countdown.' },
  { num: '03', title: 'Cast your vote',                body: 'Select your candidate, confirm once, and your encrypted ballot is committed.' },
  { num: '04', title: 'Keep your receipt',             body: 'A unique token lets you verify your vote was counted — completely anonymously.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface font-body">

      {/* ── Top Nav ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary-container text-lg">account_balance</span>
            </div>
            <span className="font-headline font-extrabold text-primary text-xl tracking-tight">Academic Vote</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Features</a>
            <a href="#how"      className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">How It Works</a>
            <Link href="/login" className="px-5 py-2.5 btn-gradient text-on-primary rounded-xl text-sm font-bold shadow-md hover:opacity-90 transition-opacity">
              Sign In
            </Link>
          </div>
          <Link href="/login" className="md:hidden px-4 py-2 btn-gradient text-on-primary rounded-lg text-sm font-bold">Sign In</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary text-on-primary">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-tertiary-container opacity-90" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-32 md:py-44">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-on-secondary-container" />
              Official University Election Portal
            </span>
            <h1 className="font-headline font-extrabold text-5xl md:text-7xl leading-none tracking-tighter mb-6">
              Your Voice.<br />
              <span className="text-secondary-container">Your Vote.</span><br />
              Verified.
            </h1>
            <p className="text-on-primary/75 text-xl leading-relaxed max-w-xl mb-10">
              The most secure, anonymous, and auditable electronic voting platform built for modern universities.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/login" className="px-8 py-4 bg-secondary-container text-on-secondary-container rounded-xl font-headline font-bold text-base shadow-xl hover:scale-[1.02] transition-transform flex items-center gap-2">
                <span className="material-symbols-outlined">how_to_vote</span>
                Get Started
              </Link>
              <a href="#how" className="px-8 py-4 bg-white/10 border border-white/20 text-on-primary rounded-xl font-headline font-bold text-base hover:bg-white/20 transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined">play_circle</span>
                How It Works
              </a>
            </div>
            <div className="mt-16 flex flex-wrap gap-10">
              {[
                { label: 'Secure Encryption',  value: 'RS256' },
                { label: 'Vote Anonymity',      value: '100%'  },
                { label: 'Uptime SLA',          value: '99.9%' },
                { label: 'Supported Faculties', value: '12+'   },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-headline font-extrabold text-3xl text-secondary-container">{value}</p>
                  <p className="text-on-primary/60 text-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-6">
        <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="font-headline font-extrabold text-4xl md:text-5xl text-primary tracking-tight">
              Built for trust.<br />Designed for scale.
            </h2>
          </div>
          <p className="text-on-surface-variant max-w-sm leading-relaxed">
            Every component was engineered with election integrity as the first principle.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon, title, body }, i) => (
            <div key={title} className={`p-8 rounded-2xl border border-outline-variant/20 hover:shadow-lg transition-all duration-300 ${i === 0 ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${i === 0 ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-primary'}`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
              </div>
              <h3 className={`font-headline font-bold text-lg mb-3 ${i === 0 ? 'text-on-primary' : 'text-primary'}`}>{title}</h3>
              <p className={`text-sm leading-relaxed ${i === 0 ? 'text-on-primary/70' : 'text-on-surface-variant'}`}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section id="how" className="py-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="font-headline font-extrabold text-4xl md:text-5xl text-primary tracking-tight">Vote in four steps</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ num, title, body }) => (
              <div key={num} className="p-8 bg-surface-container-lowest rounded-2xl shadow-sm">
                <span className="font-headline font-extrabold text-5xl text-outline-variant/40 leading-none block mb-6">{num}</span>
                <h3 className="font-headline font-bold text-lg text-primary mb-3">{title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="bg-primary rounded-3xl p-12 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="font-headline font-extrabold text-3xl md:text-4xl text-on-primary tracking-tight mb-4">
              Ready to make your voice heard?
            </h2>
            <p className="text-on-primary/70 max-w-lg">
              Sign in with your university email — no passwords required. Your 6-digit code arrives in under 60 seconds.
            </p>
          </div>
          <Link href="/login" className="flex-shrink-0 px-10 py-4 bg-secondary-container text-on-secondary-container rounded-xl font-headline font-bold shadow-xl hover:scale-[1.02] transition-transform flex items-center gap-3">
            <span className="material-symbols-outlined">how_to_vote</span>
            Sign In to Vote
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="bg-surface-dim border-t border-outline-variant/20 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary-container text-sm">shield</span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium max-w-xs">
              Votes are encrypted, anonymised, and processed through a secure audit pipeline.
            </p>
          </div>
          <div className="flex gap-8">
            {['Privacy Policy', 'Voter Rights', 'Audit Report'].map(t => (
              <a key={t} href="#" className="text-xs text-on-surface-variant font-bold uppercase tracking-widest hover:text-primary transition-colors">{t}</a>
            ))}
          </div>
          <p className="text-xs text-outline">© {new Date().getFullYear()} Academic Vote. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
