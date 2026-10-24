import type { Metadata, Viewport } from 'next';
import { Cairo } from 'next/font/google';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CartProvider } from '@/lib/cart/cart-context';
import { SetupRequired } from '@/components/SetupRequired';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'VENDORA | فيندورا — Trade Smarter. Grow Faster.',
    template: '%s | VENDORA',
  },
  description: 'سوق الجملة B2B في العراق: اربط تجارتك بموردين موثوقين. Arabic-first wholesale marketplace for businesses in Iraq.',
  applicationName: 'VENDORA',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#0f3a2c',
  width: 'device-width',
  initialScale: 1,
};

// Every page reads the visitor's session, so pages are rendered per request.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isSupabaseConfigured()) {
    return (
      <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
        <body className="flex min-h-full flex-col">
          <SetupRequired />
        </body>
      </html>
    );
  }

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <CartProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-900 focus:px-4 focus:py-2 focus:text-white"
        >
          تخطي إلى المحتوى الرئيسي
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <noscript>
          <p className="p-4 text-center">
            يحتاج VENDORA إلى تفعيل JavaScript لإتمام السلة والطلبات. <Link href="/">الصفحة الرئيسية</Link>
          </p>
        </noscript>
        </CartProvider>
      </body>
    </html>
  );
}
