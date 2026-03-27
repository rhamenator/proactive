'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

import { useAuth } from '../lib/auth-context';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/turfs', label: 'Turfs' },
  { href: '/canvassers', label: 'Canvassers' },
  { href: '/exports', label: 'Exports' }
];

export function ProtectedFrame({
  title,
  eyebrow,
  children
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const { ready, token, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) {
      router.replace('/login');
    }
  }, [ready, router, token]);

  if (!ready) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <div className="loading-orb" />
          <h1>Loading PROACTIVE Admin</h1>
          <p>Restoring the authenticated field operations workspace.</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="brand-kicker">PROACTIVE</span>
          <strong>Field Canvassing</strong>
        </div>
        <nav className="nav">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`nav-link ${active ? 'is-active' : ''}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="user-chip-label">Signed in as</span>
            <strong>
              {user?.firstName} {user?.lastName}
            </strong>
            <span>{user?.email}</span>
          </div>
          <button className="button button-secondary button-full" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="page-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          <div className="header-actions">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={`header-link ${pathname === item.href ? 'is-active' : ''}`}>
                {item.label}
              </Link>
            ))}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
