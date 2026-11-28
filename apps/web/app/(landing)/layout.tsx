import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './landing.css';

export const metadata: Metadata = {
  title: 'Tapebox: a free X Layer sandbox for TapeOut builders',
  description:
    'Tapebox forks X Layer mainnet with the real TapeOut contracts. Mint free test transistors and build without spending a single real NAND.',
  openGraph: {
    title: 'Tapebox: we take it to the fab.',
    description: 'A free X Layer sandbox for TapeOut builders. Your first chip in 60 seconds.',
  },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#060a07',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@600;700;800&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
