/**
 * @file app/layout.tsx
 * @created 2025-10-16
 * @overview Root layout with game context provider
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { GameProvider } from '@/context/GameContext';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { ToastContainer } from '@/lib/toastService';
import { Toaster } from 'sonner';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DarkFrame - Online Strategy Game',
  description: 'Tile-based strategy game with persistent 150×150 world',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WebSocketProvider>
          <GameProvider>{children}</GameProvider>
        </WebSocketProvider>
        <ToastContainer />
        <Toaster 
          theme="dark"
          position="top-right"
          expand={true}
          richColors
          toastOptions={{
            style: {
              background: 'rgb(30, 41, 59)', // bg-bg-secondary
              border: '1px solid rgb(51, 65, 85)', // border-border-main
              color: 'rgb(241, 245, 249)', // text-text-primary
              fontSize: '0.875rem',
              borderRadius: '0.5rem',
              padding: '1rem',
            },
            className: 'font-inter',
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
