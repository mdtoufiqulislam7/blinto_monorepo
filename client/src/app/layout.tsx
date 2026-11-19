import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Doomsday Ready',
  description: 'Plan your MCU rewatch and book the opening-night watch party.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
