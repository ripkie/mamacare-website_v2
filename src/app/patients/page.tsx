import AppShell from '@/components/AppShell';

export default function PatientsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl text-brand-navy">Pasien</h1>
        <p className="text-sm text-brand-navy/60 mt-1">Data pasien dan session pemeriksaan.</p>
      </div>

      <div className="bg-white rounded-2xl border border-brand-gray-border shadow-card p-6">
        <p className="text-sm text-brand-navy/50">Patient list akan dibuat di sini.</p>
      </div>
    </AppShell>
  );
}
