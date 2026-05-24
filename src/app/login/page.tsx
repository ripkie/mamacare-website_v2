import Image from 'next/image';
import { LockKeyhole, Mail } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF8] bg-pattern-dots flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-3xl shadow-card border border-brand-gray-border overflow-hidden">
          <div className="bg-gradient-to-r from-brand-yellow1 to-brand-yellow2 px-8 py-7 text-center">
            <div className="relative mx-auto w-20 h-20 mb-3">
              <Image src="/logo-mamacare.png" alt="MamaCare" fill className="object-contain" priority />
            </div>
            <h1 className="font-display text-3xl font-bold text-brand-navy">MamaCare</h1>
            <p className="text-xs uppercase tracking-[0.25em] text-brand-navy/60 font-bold mt-1">
              Monitoring System
            </p>
          </div>

          <form className="p-7 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 uppercase tracking-wide mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/35" />
                <input
                  type="email"
                  placeholder="admin@mamacare.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-brand-gray-border bg-brand-gray-soft text-sm font-medium text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-yellow2 focus:ring-2 focus:ring-brand-yellow1/30 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-navy/60 uppercase tracking-wide mb-2">
                Password
              </label>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/35" />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-brand-gray-border bg-brand-gray-soft text-sm font-medium text-brand-navy placeholder:text-brand-navy/30 focus:outline-none focus:border-brand-yellow2 focus:ring-2 focus:ring-brand-yellow1/30 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold text-sm bg-brand-yellow2 text-brand-navy hover:bg-brand-yellow1 active:scale-[0.98] shadow-sm transition-all"
            >
              Masuk Dashboard
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
