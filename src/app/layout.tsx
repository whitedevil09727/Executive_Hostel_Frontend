import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CASFOS Hostel Booking',
  description: 'Executive Hostel Booking System — CASFOS, Coimbatore',

  icons: {
    icon: '/casfos-logo.png',
    shortcut: '/casfos-logo.png',
    apple: '/casfos-logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-jakarta antialiased bg-slate-50 text-[#0F172A]">
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        {children}

        <Toaster
          position="top-right"
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}