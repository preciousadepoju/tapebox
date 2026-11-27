import { Header } from '@/components/sandbox/Header';
import { SandboxProvider } from '@/components/sandbox/Provider';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tapebox sandbox',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#060a07' };

// The mode depends on server env, so render per request rather than baking it in at build time.
export const dynamic = 'force-dynamic';

export default function SandboxLayout({ children }: { children: ReactNode }) {
  // Live fork when the server can reach one; otherwise the in-browser mock. Only a boolean leaves the server.
  const mode = process.env.TAPEBOX_RPC ? 'fork' : 'mock';
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@700;800&family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body>
        <SandboxProvider mode={mode}>
          <Header />
          <main>{children}</main>
        </SandboxProvider>
      </body>
    </html>
  );
}
