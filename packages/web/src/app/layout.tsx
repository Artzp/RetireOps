/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access */
import type { Metadata } from 'next';
import { inter, manrope } from '@/lib/fonts';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'RetireOps - Canadian Retirement Planning',
  description: 'Canadian retirement planning software with hosted and self-hosted options',
  keywords: ['retirement', 'planning', 'Canada', 'RRSP', 'TFSA', 'CPP', 'OAS'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
