'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2,
    LockKeyhole,
    Mail,
    UserRound,
} from 'lucide-react';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
} from 'firebase/auth';
import {
    doc,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';

import { auth, db } from '@/lib/firebase/client';

function getAuthErrorMessage(code?: string) {
    if (code === 'auth/email-already-in-use') {
        return 'Email ini sudah terdaftar. Silakan login.';
    }

    if (code === 'auth/invalid-email') {
        return 'Format email tidak valid.';
    }

    if (code === 'auth/weak-password') {
        return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    }

    if (code === 'auth/network-request-failed') {
        return 'Koneksi internet bermasalah. Coba lagi.';
    }

    return 'Registrasi gagal. Periksa data lalu coba lagi.';
}

export default function RegisterPage() {
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName) {
            setError('Nama bidan wajib diisi.');
            return;
        }

        if (password.length < 6) {
            setError('Password minimal 6 karakter.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Konfirmasi password tidak sama.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const credential = await createUserWithEmailAndPassword(
                auth,
                cleanEmail,
                password,
            );

            await updateProfile(credential.user, {
                displayName: cleanName,
            });

            await setDoc(doc(db, 'users', credential.user.uid), {
                uid: credential.user.uid,
                name: cleanName,
                email: cleanEmail,
                role: 'nurse',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

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
        <main className="flex min-h-screen items-center justify-center bg-[#FAFAF8] bg-pattern-dots px-4 py-8">
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
                            Daftar MamaCare
                        </h1>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-brand-navy/60">
                            Akun Bidan
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
                                Nama Bidan
                            </label>
                            <div className="relative">
                                <UserRound
                                    size={17}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/35"
                                />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="Contoh: Bidan Sari"
                                    className="w-full rounded-xl border border-brand-gray-border bg-brand-gray-soft py-3 pl-11 pr-4 text-sm font-medium text-brand-navy placeholder:text-brand-navy/30 transition focus:border-brand-yellow2 focus:outline-none focus:ring-2 focus:ring-brand-yellow1/30"
                                    required
                                />
                            </div>
                        </div>

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
                                    placeholder="bidan@mamacare.com"
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
                                    placeholder="Minimal 6 karakter"
                                    className="w-full rounded-xl border border-brand-gray-border bg-brand-gray-soft py-3 pl-11 pr-4 text-sm font-medium text-brand-navy placeholder:text-brand-navy/30 transition focus:border-brand-yellow2 focus:outline-none focus:ring-2 focus:ring-brand-yellow1/30"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-brand-navy/60">
                                Konfirmasi Password
                            </label>
                            <div className="relative">
                                <LockKeyhole
                                    size={17}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/35"
                                />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    placeholder="Ulangi password"
                                    className="w-full rounded-xl border border-brand-gray-border bg-brand-gray-soft py-3 pl-11 pr-4 text-sm font-medium text-brand-navy placeholder:text-brand-navy/30 transition focus:border-brand-yellow2 focus:outline-none focus:ring-2 focus:ring-brand-yellow1/30"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-yellow2 py-3.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-yellow1 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isSubmitting ? 'Mendaftarkan...' : 'Daftar Akun'}
                        </button>

                        <p className="text-center text-xs text-brand-navy/50">
                            Sudah punya akun?{' '}
                            <Link
                                href="/login"
                                className="font-bold text-brand-navy underline decoration-brand-yellow2 decoration-2 underline-offset-4"
                            >
                                Login di sini
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </main>
    );
}
