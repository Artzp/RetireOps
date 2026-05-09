import type { Metadata } from 'next';
import Script from 'next/script';
import { inter, manrope } from '@/lib/fonts';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'RetireOps - Canadian Retirement Planning',
  description: 'Canadian retirement planning software with hosted and self-hosted options',
  keywords: ['retirement', 'planning', 'Canada', 'RRSP', 'TFSA', 'CPP', 'OAS'],
};

const gaId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
