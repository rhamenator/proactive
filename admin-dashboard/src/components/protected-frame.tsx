'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

import { useAuth } from '../lib/auth-context';
import type { Role } from '../lib/types';

type NavItem = {
  href: string;
  label: string;
  roles: Role[];
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['admin', 'supervisor'] },
  { href: '/reports', label: 'Reports', roles: ['admin', 'supervisor'] },
  { href: '/turfs', label: 'Turfs', roles: ['admin', 'supervisor'] },
  { href: '/address-requests', label: 'Address Requests', roles: ['admin', 'supervisor'] },
  { href: '/visit-corrections', label: 'Visit Corrections', roles: ['admin', 'supervisor'] },
  { href: '/gps-review', label: 'GPS Review', roles: ['admin', 'supervisor'] },
  { href: '/sync-conflicts', label: 'Sync Conflicts', roles: ['admin', 'supervisor'] },
  { href: '/import-reviews', label: 'Import Reviews', roles: ['admin'] },
  { href: '/outcomes', label: 'Outcomes', roles: ['admin', 'supervisor'] },
  { href: '/policies', label: 'Policies', roles: ['admin', 'supervisor'] },
  { href: '/canvassers', label: 'Field Users', roles: ['admin', 'supervisor'] },
  { href: '/exports', label: 'Exports', roles: ['admin'] },
  { href: '/field-preview', label: 'Field Preview', roles: ['canvasser'] },
  { href: '/account', label: 'Account', roles: ['admin', 'supervisor', 'canvasser'] }
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
  const { ready, token, user, impersonation, logout, stopImpersonation } = useAuth();
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

  const visibleNavItems = navItems.filter((item) => (user ? item.roles.includes(user.role) : true));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="brand-kicker">PROACTIVE</span>
          <strong>Field Canvassing</strong>
        </div>
        <nav className="nav">
          {visibleNavItems.map((item) => {
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
            <span>{user?.role}</span>
          </div>
          <button className="button button-secondary button-full" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        {impersonation ? (
          <div className="notice notice-warning">
            <div className="inline-actions inline-actions-between">
              <div className="stack-tight">
                <strong>Impersonation Active</strong>
                <span className="muted">
                  Acting as {user?.firstName} {user?.lastName}
                  {impersonation.actorName ? ` on behalf of ${impersonation.actorName}` : ''}
                  {impersonation.reasonText ? ` • ${impersonation.reasonText}` : ''}
                </span>
              </div>
              <button className="button button-danger" onClick={() => void stopImpersonation()}>
                Stop Impersonation
              </button>
            </div>
          </div>
        ) : null}
        <header className="page-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          <div className="header-actions">
            {visibleNavItems.map((item) => (
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
