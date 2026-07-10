import type { Metadata } from 'next';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { OmaghAdminProvider } from '@/contexts/OmaghAdminContext';
import ContextMenuBlocker from '@/components/ContextMenuBlocker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Omagh Phone & Vape | Mobile Repair & Accessories',
  description: 'Professional iPhone & Samsung repair, accessories and premium products in Omagh',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ContextMenuBlocker />
        <OmaghAdminProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </OmaghAdminProvider>
      </body>
    </html>
  );
}
