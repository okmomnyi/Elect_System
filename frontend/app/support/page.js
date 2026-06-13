'use client';

import Link from 'next/link';

const FAQ = [
  {
    q: 'How do I sign in?',
    a: 'Enter your university email and password, then the 6-digit code we email you. The code is valid for a few minutes — you can retype it if you mistype; it is only consumed once you enter it correctly.',
  },
  {
    q: 'I did not receive my code',
    a: 'Check your spam folder. You can request a new code from the verification screen. For your security, codes and requests are rate-limited, so wait a moment before retrying.',
  },
  {
    q: 'Can I change my vote?',
    a: 'No. Each voter may vote once per election and ballots are anonymous, so a cast vote cannot be changed or withdrawn.',
  },
  {
    q: 'When can I see results?',
    a: 'Results appear after you have voted, or once the election closes. During an active election the running tally is hidden until you cast your ballot.',
  },
  {
    q: 'I forgot my password',
    a: 'Use the “Forgot password” link on the sign-in screen to receive a reset link by email.',
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16 max-w-4xl mx-auto">
          <h1 className="font-headline font-bold text-xl text-primary tracking-tight">Help &amp; Support</h1>
          <Link href="/dashboard" className="text-sm font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </Link>
        </div>
      </header>

      <div className="p-8 max-w-4xl mx-auto space-y-10">
        <section className="space-y-2">
          <h2 className="font-headline text-3xl font-extrabold text-primary">We&apos;re here to help</h2>
          <p className="text-on-surface-variant">
            Find quick answers below, or reach the election administration team directly.
          </p>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <a
            href="mailto:elections-support@university.edu"
            className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow"
          >
            <span className="material-symbols-outlined text-primary text-3xl p-3 bg-primary/5 rounded-xl">mail</span>
            <div>
              <p className="font-bold text-primary">Email support</p>
              <p className="text-sm text-on-surface-variant">elections-support@university.edu</p>
            </div>
          </a>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 flex items-center gap-4">
            <span className="material-symbols-outlined text-secondary text-3xl p-3 bg-secondary/5 rounded-xl">schedule</span>
            <div>
              <p className="font-bold text-primary">Support hours</p>
              <p className="text-sm text-on-surface-variant">Mon–Fri, 9:00–17:00</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-headline font-bold text-xl text-primary">Frequently asked questions</h3>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="group bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden"
              >
                <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between font-bold text-primary">
                  {q}
                  <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">
                    expand_more
                  </span>
                </summary>
                <p className="px-6 pb-5 text-sm text-on-surface-variant leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
