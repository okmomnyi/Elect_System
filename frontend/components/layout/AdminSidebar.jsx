'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/api';

const navLinks = [
  { href: '/admin',             label: 'Elections',  icon: 'ballot',       exact: true },
  { href: '/admin/candidates',  label: 'Candidates', icon: 'person_search' },
  { href: '/admin/results',     label: 'Results',    icon: 'analytics'     },
  { href: '/admin/audit',       label: 'Audit Logs', icon: 'manage_search' },
  { href: '/admin/config',      label: 'Config',     icon: 'settings'      },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    try { await auth.logout(); } catch (_) {}
    router.push('/login');
  }

  function isActive(href, exact) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-slate-100 py-6 px-4 z-50 border-r border-outline-variant/20">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-secondary-container text-xl">school</span>
        </div>
        <div className="min-w-0">
          <h2 className="font-headline font-extrabold text-primary text-base leading-tight truncate">
            Digital Dean
          </h2>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Admin Portal
          </p>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 space-y-1">
        {navLinks.map(({ href, label, icon, exact }) => {
          const active = isActive(href, exact);
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

      {/* Bottom */}
      <div className="pt-4 mt-4 border-t border-slate-200 space-y-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-200 hover:translate-x-1 transition-all duration-200 rounded-xl"
        >
          <span className="material-symbols-outlined text-xl">open_in_new</span>
          <span>Student View</span>
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 rounded-xl"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          <span>Sign Out</span>
        </button>
      </div>

      {/* CTA */}
      <Link
        href="/admin/elections/new"
        className="mt-6 w-full py-3.5 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-xl">add_circle</span>
        New Election
      </Link>
    </aside>
  );
}
