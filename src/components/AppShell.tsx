'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import Header from './Navbar';
import { auth } from '@/lib/firebase/client';

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && pathname !== '/login' && pathname !== '/register') {
        router.replace('/login');
        return;
      }

      setCheckingAuth(false);
    });

    return unsubscribe;
  }, [pathname, router]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-[#FAFAF8] px-4">
        <div className="w-full max-w-xs rounded-3xl border border-brand-gray-border bg-white p-6 text-center shadow-card">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-yellow2" />
          <p className="mt-3 text-sm font-semibold text-brand-navy/60">
            Mengecek sesi login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#FAFAF8]">
      <Header />

      <main className="w-full px-2 pb-24 pt-3 sm:px-4 sm:pb-8 sm:pt-5 lg:mx-auto lg:max-w-7xl lg:px-6">
        <div className="min-w-0">{children}</div>
      </main>

      <footer className="hidden border-t border-brand-gray-border bg-white py-3 text-center text-[11px] font-medium text-brand-navy/40 md:block">
        MamaCare © {new Date().getFullYear()} - Maternal Health Monitoring System
      </footer>
    </div>
  );
}
