import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';

import './globals.css';
import { AuthProvider } from '../src/lib/auth-context';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body'
});

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display'
});

export const metadata: Metadata = {
  title: 'PROACTIVE FCS Admin',
  description: 'Admin dashboard for turf imports, field-user management, and VAN exports.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
