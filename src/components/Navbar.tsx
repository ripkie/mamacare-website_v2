'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardList,
  Cpu,
  Home,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { auth, db } from '@/lib/firebase/client';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/devices', label: 'Devices', icon: Cpu },
  { href: '/patients', label: 'Pasien', icon: UserRound },
  { href: '/riwayat', label: 'Riwayat', icon: ClipboardList },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setEmail(user?.email ?? null);

      if (!user) {
        setRole(null);
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        setRole(userSnap.exists() ? String(userSnap.data().role ?? '') : null);
      } catch (error) {
        console.error('Failed to read user role:', error);
        setRole(null);
      }
    });

    return unsubscribe;
  }, []);

  async function handleLogout() {
    await signOut(auth);
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-brand-gray-border bg-white">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-5 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2 sm:h-16 lg:h-18">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
            <div className="relative h-9 w-9 sm:h-11 sm:w-11">
              <Image
                src="/logo-mamacare.png"
                alt="MamaCare"
                fill
                className="object-contain"
                priority
              />
            </div>

            <div className="hidden leading-tight sm:block">
              <p className="font-display text-lg font-bold text-brand-navy">
                MamaCare
              </p>
              <p className="text-[9px] uppercase tracking-widest text-brand-navy/45">
                Monitoring System
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {[
              ...navItems,
              ...(role === 'admin'
                ? [{ href: '/admin/devices', label: 'Admin', icon: ShieldCheck }]
                : []),
            ].map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== '/dashboard' && pathname.startsWith(href));

              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[11px] font-bold sm:px-3 sm:text-sm',
                    active
                      ? 'bg-brand-yellow1 text-brand-navy'
                      : 'text-brand-navy/55 hover:bg-brand-yellow1/15',
                  )}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 sm:px-3 sm:text-sm"
              title={email ?? 'Logout'}
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
