import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = { title: 'Sign In — Academic Vote' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">

      {/* ── Left panel – branding ──────────────────────────── */}
      <div className="hidden md:flex flex-col justify-between bg-primary text-on-primary w-[44%] p-14 relative overflow-hidden">
        {/* decorative pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-primary-container to-transparent opacity-60" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-on-secondary-container text-xl">account_balance</span>
          </div>
          <span className="font-headline font-extrabold text-xl tracking-tight">Academic Vote</span>
        </div>

        {/* Copy */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container/20 border border-secondary-container/30 rounded-full text-xs font-bold uppercase tracking-widest text-secondary-container">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
            Official Portal
          </div>
          <h1 className="font-headline font-extrabold text-4xl leading-tight tracking-tight">
            Democracy<br />starts here.
          </h1>
          <p className="text-on-primary/65 text-base leading-relaxed max-w-xs">
            Secure, anonymous, and fully auditable electronic elections for your university community.
          </p>
          <div className="flex flex-col gap-3">
            {[
              { icon: 'shield',         label: 'Password + OTP two-factor auth' },
              { icon: 'visibility_off', label: 'Anonymous by architecture'       },
              { icon: 'receipt_long',   label: 'Cryptographic vote receipts'     },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-on-primary/70 text-sm">
                <span className="material-symbols-outlined text-secondary-container text-base">{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-on-primary/40">
          © {new Date().getFullYear()} University Electoral Commission
        </p>
      </div>

      {/* ── Right panel – form ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-14">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="flex items-center gap-3 mb-10 md:hidden">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary-container text-lg">account_balance</span>
            </div>
            <span className="font-headline font-extrabold text-primary text-lg">Academic Vote</span>
          </div>

          <div className="mb-8">
            <h2 className="font-headline font-extrabold text-3xl text-primary mb-2">Welcome back</h2>
            <p className="text-on-surface-variant">Sign in with your password — a 6-digit code will verify it.</p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Having trouble?{' '}
            <Link href="/support" className="font-bold text-primary hover:underline">Contact IT Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
