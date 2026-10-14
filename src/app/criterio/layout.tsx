import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Criterio' },
  description: 'Jurisprudencia peruana en tu celular.',
  manifest: '/criterio.webmanifest',
  appleWebApp: { capable: true, title: 'Criterio', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-50">{children}</div>;
}
