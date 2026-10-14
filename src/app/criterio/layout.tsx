import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Criterio' },
  description: 'Jurisprudencia peruana en tu celular.',
  manifest: '/criterio.webmanifest',
  icons: { icon: '/criterio-192.png', apple: '/criterio-192.png' },
  appleWebApp: { capable: true, title: 'Criterio', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#4338ca',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-indigo-50/25 to-slate-100/70 text-slate-900 antialiased selection:bg-indigo-500/20 selection:text-indigo-900">
      {children}
    </div>
  );
}
