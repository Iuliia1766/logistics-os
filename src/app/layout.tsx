import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://freightforwardco.com'),
  title: {
    default: 'FreightForward Co. — Freight, Finally Transparent.',
    template: '%s · FreightForward Co.',
  },
  description:
    'The AI-powered logistics platform connecting shippers, brokers, and carriers — with '
    + 'real-time visibility from pickup to delivery, and no surprises along the way.',
  openGraph: {
    title: 'FreightForward Co. — Freight, Finally Transparent.',
    description: 'Transparent freight. From pickup to delivery.',
    url: 'https://freightforwardco.com',
    siteName: 'FreightForward Co.',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FreightFwd',
  },
};

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
