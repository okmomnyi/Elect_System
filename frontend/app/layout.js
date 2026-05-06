import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'Academic Vote — University Voter Portal',
  description: 'Secure, anonymous, and auditable electronic voting for university elections.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-surface text-on-surface font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
