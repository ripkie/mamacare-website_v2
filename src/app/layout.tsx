import './globals.css';

export const metadata = {
  title: 'MamaCare V2',
  description: 'Maternal Health Monitoring System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
