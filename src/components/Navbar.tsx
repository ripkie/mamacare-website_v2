'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Cpu, UserRound, ClipboardList, LogIn } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/devices', label: 'Devices', icon: Cpu },
  { href: '/patients', label: 'Pasien', icon: UserRound },
  { href: '/riwayat', label: 'Riwayat', icon: ClipboardList },
  { href: '/login', label: 'Login', icon: LogIn },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-brand-gray-border">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-14 sm:h-16 lg:h-18">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="relative w-9 h-9 sm:w-11 sm:h-11">
              <Image src="/logo-mamacare.png" alt="MamaCare" fill className="object-contain" priority />
            </div>

            <div className="hidden sm:block leading-tight">
              <p className="font-display font-bold text-lg text-brand-navy">MamaCare</p>
              <p className="text-[9px] uppercase tracking-widest text-brand-navy/45">
                Monitoring System
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-sm font-bold whitespace-nowrap',
                    active
                      ? 'bg-brand-yellow1 text-brand-navy'
                      : 'text-brand-navy/55 hover:bg-brand-yellow1/15'
                  )}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
