import AppShell from '@/components/AppShell';
import { Activity, Cpu, HeartPulse, UsersRound } from 'lucide-react';

const stats = [
  { label: 'Device Aktif', value: '0', icon: Cpu },
  { label: 'Session Hari Ini', value: '0', icon: Activity },
  { label: 'Pasien', value: '0', icon: UsersRound },
  { label: 'Measurement', value: '0', icon: HeartPulse },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl lg:text-4xl text-brand-navy leading-tight">
          Dashboard MamaCare V2
        </h1>
        <p className="text-sm text-brand-navy/60 mt-1">
          Monitoring device, session, pasien, dan hasil pengukuran secara realtime.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-brand-gray-border shadow-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">{label}</p>
                <p className="font-display text-4xl font-bold text-brand-navy mt-2">{value}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-brand-yellow1/25 flex items-center justify-center text-brand-yellow2">
                <Icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-brand-gray-border shadow-card p-6">
          <h2 className="font-display font-bold text-xl text-brand-navy">Session Flow</h2>
          <p className="text-sm text-brand-navy/55 mt-2">
            ESP32 mengatur posisi lokal: duduk → miring_kiri → terlentang. Web/API hanya menerima data dan mengupdate state.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-brand-gray-border shadow-card p-6">
          <h2 className="font-display font-bold text-xl text-brand-navy">API Ready</h2>
          <p className="text-sm text-brand-navy/55 mt-2">
            Endpoint awal: <span className="font-bold">GET device command</span> dan <span className="font-bold">POST /api/measurements</span>.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
