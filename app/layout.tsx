import type { Metadata, Viewport } from 'next';

import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';

import './globals.css';

export const metadata: Metadata = {
  title: 'Nadi',
  description: '記錄自己的生活訊號',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/logo/nadi-logo-pure.png',
    shortcut: '/logo/nadi-logo-pure.png',
    apple: '/logo/nadi-logo-pure.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nadi',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f2e8',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
