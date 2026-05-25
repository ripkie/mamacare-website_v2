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
import { useEffect, useMemo, useState } from 'react';

import { auth, db } from '@/lib/firebase/client';

const baseNavItems = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: Home },
  { href: '/devices', label: 'Devices', shortLabel: 'Device', icon: Cpu },
  { href: '/patients', label: 'Pasien', shortLabel: 'Pasien', icon: UserRound },
  { href: '/riwayat', label: 'Riwayat', shortLabel: 'Riwayat', icon: ClipboardList },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setEmail(user?.email ?? null);
      setDisplayName(user?.displayName ?? null);

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

  const navItems = useMemo(() => {
    return [
      ...baseNavItems,
      ...(role === 'admin'
        ? [
          {
            href: '/admin/devices',
            label: 'Admin',
            shortLabel: 'Admin',
            icon: ShieldCheck,
          },
        ]
        : []),
    ];
  }, [role]);

  async function handleLogout() {
    await signOut(auth);
    router.replace('/login');
  }

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-brand-gray-border bg-white/95 backdrop-blur">
        <div className="flex h-14 w-full items-center justify-between gap-3 px-3 sm:h-16 sm:px-5 lg:mx-auto lg:max-w-7xl lg:px-8">
          <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2">
            <div className="relative h-9 w-9 shrink-0 sm:h-11 sm:w-11">
              <Image
                src="/logo-mamacare.png"
                alt="MamaCare"
                fill
                className="object-contain"
                priority
              />
            </div>

            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-base font-bold text-brand-navy sm:text-lg">
                MamaCare
              </p>
              <p className="hidden text-[9px] uppercase tracking-widest text-brand-navy/45 sm:block">
                Monitoring System
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);

              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition',
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
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right lg:block">
              <p className="truncate text-xs font-bold text-brand-navy">
                {displayName || email || 'User'}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-brand-navy/40">
                {role || 'nurse'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
              title={email ?? 'Logout'}
            >
              <span className="hidden sm:inline">Logout</span>
              <LogOut className="h-4 w-4 sm:hidden" />
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 w-full border-t border-brand-gray-border bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div
          className="grid w-full gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.min(navItems.length, 5)}, minmax(0, 1fr))` }}
        >
          {navItems.slice(0, 5).map(({ href, shortLabel, icon: Icon }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[10px] font-bold transition',
                  active
                    ? 'bg-brand-yellow1 text-brand-navy'
                    : 'text-brand-navy/50 active:bg-brand-yellow1/20',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-1 max-w-full truncate">{shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
