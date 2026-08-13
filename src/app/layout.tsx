import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Inter, Unbounded } from 'next/font/google';

import './globals.css';

const display = Unbounded({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--fuente-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fuente-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fuente-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'SOMOS',
    template: '%s · SOMOS',
  },
  description:
    'Fiesta de música electrónica. Compra tu entrada, recibe tu QR y nos vemos en la pista.',
  openGraph: {
    title: 'SOMOS',
    description:
      'Fiesta de música electrónica. Compra tu entrada, recibe tu QR y nos vemos en la pista.',
    type: 'website',
    locale: 'es_CL',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#05060A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
