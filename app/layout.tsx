import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'FactorFive — five-factor equity analysis',
    template: '%s | FactorFive',
  },
  description:
    'Five-factor equity analysis: growth, profitability, valuation, quality and analyst consensus, benchmarked against size-matched industry peers and the broader market.',
  keywords: [
    'stock analysis',
    'factor investing',
    'equity research',
    'fundamental analysis',
    'peer benchmarking',
  ],
};

/* Tells the browser both palettes exist, so form controls and the URL bar
   match the page instead of defaulting to light. */
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#08090c' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
