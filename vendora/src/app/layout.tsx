import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { CartProvider } from '@/components/cart/cart-provider';

export const metadata: Metadata = {
  title: {
    default: 'VENDORA | Trade Smarter. Grow Faster.',
    template: '%s | VENDORA',
  },
  description: 'منصة فينــدورا للتجارة بالجملة بين المشترين التجاريين والموردين في العراق.',
  applicationName: 'VENDORA',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f3d2e',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh flex flex-col">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
