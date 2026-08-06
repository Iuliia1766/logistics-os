import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Logistics OS',
  description: 'One shared load ledger. Separate portals for drivers and shippers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
