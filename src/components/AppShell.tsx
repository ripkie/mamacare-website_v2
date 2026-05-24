import Header from './Navbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-5">
        {children}
      </main>

      <footer className="hidden sm:block border-t border-brand-gray-border bg-white py-3 text-center text-[11px] text-brand-navy/40 font-medium">
        MamaCare © {new Date().getFullYear()} - Maternal Health Monitoring System
      </footer>
    </div>
  );
}
