import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VENDORA — سوق الجملة',
    short_name: 'VENDORA',
    description: 'اربط تجارتك بموردين موثوقين في العراق',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ar',
    dir: 'rtl',
    background_color: '#f6f9f7',
    theme_color: '#0f3a2c',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
