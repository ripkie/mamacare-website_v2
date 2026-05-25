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
      if (!user && pathname !== '/login') {
        router.replace('/login');
        return;
      }

      setCheckingAuth(false);
    });

    return unsubscribe;
  }, [pathname, router]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="rounded-3xl border border-brand-gray-border bg-white p-6 text-center shadow-card">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand-yellow2" />
          <p className="mt-3 text-sm font-semibold text-brand-navy/60">
            Mengecek sesi login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF8]">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
        {children}
      </main>

      <footer className="hidden border-t border-brand-gray-border bg-white py-3 text-center text-[11px] font-medium text-brand-navy/40 sm:block">
        MamaCare © {new Date().getFullYear()} - Maternal Health Monitoring System
      </footer>
    </div>
  );
}
