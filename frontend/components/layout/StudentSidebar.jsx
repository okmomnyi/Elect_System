'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const navLinks = [
  { href: '/dashboard',  label: 'Elections', icon: 'ballot'    },
  { href: '/results',    label: 'Results',   icon: 'analytics'  },
  { href: '/candidates', label: 'Candidates',icon: 'groups'     },
];

const bottomLinks = [
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/support',  label: 'Support',  icon: 'help'     },
];

export default function StudentSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    // Context logout clears cached user state in addition to the server cookie.
    await logout();
    router.push('/login');
  }

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-slate-100 py-6 px-4 z-50 border-r border-outline-variant/20">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-secondary-container text-xl">account_balance</span>
        </div>
        <div className="min-w-0">
          <h2 className="font-headline font-extrabold text-primary text-base leading-tight truncate">
            Digital Dean
          </h2>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Voter Portal
          </p>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 space-y-1">
        {navLinks.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${
                active
                  ? 'nav-link-active shadow-sm'
                  : 'text-slate-500 hover:bg-slate-200 hover:translate-x-1 hover:text-primary'
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {icon}
              </span>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav + logout */}
      <div className="pt-4 mt-4 border-t border-slate-200 space-y-1">
        {bottomLinks.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-200 hover:translate-x-1 transition-all duration-200 rounded-xl"
          >
            <span className="material-symbols-outlined text-xl">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}

        {user && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 rounded-xl mt-1"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            <span>Sign Out</span>
          </button>
        )}
      </div>

      {/* Cast Vote CTA */}
      <Link
        href="/dashboard"
        className="mt-6 w-full py-3.5 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-xl">how_to_vote</span>
        Cast Vote
      </Link>
    </aside>
  );
}
