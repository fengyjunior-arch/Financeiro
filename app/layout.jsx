import './globals.css';

export const metadata = {
  title: 'Finanças C6',
  description: 'Gastos, saldo e investimentos do C6 Bank.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Finanças', statusBarStyle: 'black-translucent' },
};

export const viewport = {
  themeColor: '#0b0a09',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
