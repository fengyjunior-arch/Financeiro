import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata = {
  title: 'Finanças C6',
  description: 'Gastos, saldo e investimentos do C6 Bank.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Finanças', statusBarStyle: 'black-translucent' },
};

export const viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
