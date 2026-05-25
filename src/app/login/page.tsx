'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LockKeyhole,
  Loader2,
  Mail,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from '@/lib/firebase/client';
import Link from "next/link";

function getAuthErrorMessage(code?: string) {
  if (code === 'auth/invalid-credential') {
    return 'Email atau password salah.';
  }

  if (code === 'auth/user-not-found') {
    return 'Akun tidak ditemukan.';
  }

  if (code === 'auth/wrong-password') {
    return 'Password salah.';
  }

  if (code === 'auth/invalid-email') {
    return 'Format email tidak valid.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Terlalu banyak percobaan login. Coba lagi nanti.';
  }

  return 'Login gagal. Periksa email dan password.';
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('admin@mamacare.com');
  const [password, setPassword] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/dashboard');
        return;
      }

      setIsChecking(false);
    });

    return unsubscribe;
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String(err.code)
          : undefined;

      setError(getAuthErrorMessage(code));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="h-7 w-7 animate-spin text-brand-yellow2" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF8] bg-pattern-dots px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="overflow-hidden rounded-3xl border border-brand-gray-border bg-white shadow-card">
          <div className="bg-gradient-to-r from-brand-yellow1 to-brand-yellow2 px-8 py-7 text-center">
            <div className="relative mx-auto mb-3 h-20 w-20">
              <Image
                src="/logo-mamacare.png"
                alt="MamaCare"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className="font-display text-3xl font-bold text-brand-navy">
              MamaCare
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-brand-navy/60">
              Monitoring System
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-7">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-brand-navy/60">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/35"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@mamacare.com"
                  className="w-full rounded-xl border border-brand-gray-border bg-brand-gray-soft py-3 pl-11 pr-4 text-sm font-medium text-brand-navy placeholder:text-brand-navy/30 transition focus:border-brand-yellow2 focus:outline-none focus:ring-2 focus:ring-brand-yellow1/30"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-brand-navy/60">
                Password
              </label>
              <div className="relative">
                <LockKeyhole
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/35"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-brand-gray-border bg-brand-gray-soft py-3 pl-11 pr-4 text-sm font-medium text-brand-navy placeholder:text-brand-navy/30 transition focus:border-brand-yellow2 focus:outline-none focus:ring-2 focus:ring-brand-yellow1/30"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow2 py-3.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-yellow1 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Masuk...' : 'Masuk Dashboard'}
            </button>

            <p className="text-center text-xs text-brand-navy/50">
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="font-bold text-brand-navy underline decoration-brand-yellow2 decoration-2 underline-offset-4"
              >
                Daftar di sini
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
