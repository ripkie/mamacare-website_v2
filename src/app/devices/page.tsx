'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { db } from '@/lib/firebase/client';
import { collection, onSnapshot, query } from 'firebase/firestore';
import {
  Activity,
  Battery,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  Radio,
  Stethoscope,
  UserRound,
  Wifi,
} from 'lucide-react';

type DeviceStatus = 'available' | 'in_use' | 'offline' | string;
type SessionStatus = 'idle' | 'active' | 'completed' | 'cancelled' | string;

type Device = {
  deviceId: string;
  deviceName: string;
  status: DeviceStatus;
  currentSessionId: string | null;
  currentPatientId: string | null;
  currentPatientName: string | null;
  sessionStatus: SessionStatus;
  batteryRaw: number | null;
  wifiStatus: string | null;
  lastSeenEpoch: number | null;
  registeredBy: string | null;
};

function statusClass(status?: string) {
  if (status === 'available') return 'border-green-200 bg-green-50 text-green-700';
  if (status === 'in_use') return 'border-yellow-200 bg-yellow-50 text-yellow-800';
  if (status === 'offline') return 'border-red-200 bg-red-50 text-red-700';

  return 'border-brand-gray-border bg-brand-gray-soft text-brand-navy/60';
}

function sessionClass(status?: string) {
  if (status === 'active') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'idle') return 'border-brand-gray-border bg-brand-gray-soft text-brand-navy/60';
  if (status === 'completed') return 'border-green-200 bg-green-50 text-green-700';
  if (status === 'cancelled') return 'border-red-200 bg-red-50 text-red-700';

  return 'border-brand-gray-border bg-brand-gray-soft text-brand-navy/60';
}

function bindingClass(isBound: boolean) {
  return isBound
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-brand-gray-border bg-brand-gray-soft text-brand-navy/55';
}

function formatLastSeen(epoch: number | null) {
  if (!epoch) return '-';

  const epochMs = epoch < 10_000_000_000 ? epoch * 1000 : epoch;

  return new Date(epochMs).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatBattery(raw: number | null) {
  if (raw === null || raw === undefined) return '-';

  return String(raw);
}

function getDeviceMeaning(device: Device) {
  const isBound = Boolean(device.currentPatientId);
  const isMeasuring = device.status === 'in_use' && device.sessionStatus === 'active';

  if (device.status === 'offline') {
    return {
      title: 'Offline',
      description: 'Device belum online atau belum mengirim status terbaru.',
    };
  }

  if (isMeasuring) {
    return {
      title: 'Sedang pemeriksaan',
      description: 'Device sedang menjalankan session aktif dan menunggu data ESP32.',
    };
  }

  if (isBound) {
    return {
      title: 'Standby untuk pasien',
      description: 'Device tidak sedang mengukur, tetapi masih terikat ke pasien aktif.',
    };
  }

  return {
    title: 'Kosong',
    description: 'Device available dan belum terikat ke pasien mana pun.',
  };
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const devicesQuery = query(collection(db, 'devices'));

    const unsubscribe = onSnapshot(
      devicesQuery,
      (snapshot) => {
        const nextDevices = snapshot.docs.map((deviceDoc) => {
          const data = deviceDoc.data() as Partial<Device>;

          return {
            deviceId: data.deviceId || deviceDoc.id,
            deviceName: data.deviceName || deviceDoc.id,
            status: data.status || 'available',
            currentSessionId: data.currentSessionId ?? null,
            currentPatientId: data.currentPatientId ?? null,
            currentPatientName: data.currentPatientName ?? null,
            sessionStatus: data.sessionStatus || 'idle',
            batteryRaw: data.batteryRaw ?? null,
            wifiStatus: data.wifiStatus ?? 'unknown',
            lastSeenEpoch: data.lastSeenEpoch ?? null,
            registeredBy: data.registeredBy ?? null,
          };
        });

        setDevices(nextDevices);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to listen devices:', err);
        setError('Gagal membaca data devices dari Firestore. Cek rules dan nama collection.');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    return {
      total: devices.length,
      available: devices.filter((device) => device.status === 'available').length,
      inUse: devices.filter((device) => device.status === 'in_use').length,
      offline: devices.filter((device) => device.status === 'offline').length,
      bound: devices.filter((device) => Boolean(device.currentPatientId)).length,
    };
  }, [devices]);

  return (
    <AppShell>
      <div className="mb-3 flex flex-col gap-2 lg:mb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy lg:text-4xl">
            Devices
          </h1>
          <p className="mt-1 text-xs text-brand-navy/60 sm:text-sm">
            Monitoring alat MamaCare. Device bisa available tetapi tetap terikat ke pasien aktif.
          </p>
        </div>

      </div>

      <div className="mb-3 grid grid-cols-5 gap-2 lg:mb-5 lg:gap-3">
        <div className="min-w-0 rounded-2xl border border-brand-gray-border bg-white px-2 py-2 shadow-card sm:p-4">
          <p className="truncate text-[8px] font-bold uppercase tracking-wide text-brand-navy/45 sm:text-[11px]">
            Total Device
          </p>
          <p className="font-display mt-0.5 text-xl font-bold leading-none text-brand-navy sm:mt-1 sm:text-3xl">
            {summary.total}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-green-100 bg-white px-2 py-2 shadow-card sm:p-4">
          <p className="truncate text-[8px] font-bold uppercase tracking-wide text-brand-navy/45 sm:text-[11px]">
            Available
          </p>
          <p className="font-display mt-0.5 text-xl font-bold leading-none text-green-700 sm:mt-1 sm:text-3xl">
            {summary.available}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-yellow-100 bg-white px-2 py-2 shadow-card sm:p-4">
          <p className="truncate text-[8px] font-bold uppercase tracking-wide text-brand-navy/45 sm:text-[11px]">
            In Use
          </p>
          <p className="font-display mt-0.5 text-xl font-bold leading-none text-yellow-700 sm:mt-1 sm:text-3xl">
            {summary.inUse}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-emerald-100 bg-white px-2 py-2 shadow-card sm:p-4">
          <p className="truncate text-[8px] font-bold uppercase tracking-wide text-brand-navy/45 sm:text-[11px]">
            Terikat Pasien
          </p>
          <p className="font-display mt-0.5 text-xl font-bold leading-none text-emerald-700 sm:mt-1 sm:text-3xl">
            {summary.bound}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl border border-red-100 bg-white px-2 py-2 shadow-card sm:p-4">
          <p className="truncate text-[8px] font-bold uppercase tracking-wide text-brand-navy/45 sm:text-[11px]">
            Offline
          </p>
          <p className="font-display mt-0.5 text-xl font-bold leading-none text-red-700 sm:mt-1 sm:text-3xl">
            {summary.offline}
          </p>
        </div>
      </div>

      <div className="mb-3 rounded-2xl border border-brand-gray-border bg-white p-3 shadow-card lg:mb-5 lg:rounded-3xl lg:p-4">
        <h2 className="font-display text-lg font-bold text-brand-navy">
          Cara membaca status
        </h2>
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-brand-navy/65 sm:grid-cols-3 sm:text-sm">
          <div className="rounded-xl bg-brand-gray-soft p-2 sm:rounded-2xl sm:p-3">
            <b className="text-brand-navy">Available</b> berarti alat sedang standby / tidak mengukur.
          </div>
          <div className="rounded-xl bg-brand-gray-soft p-2 sm:rounded-2xl sm:p-3">
            <b className="text-brand-navy">In Use</b> berarti alat sedang dalam pemeriksaan aktif.
          </div>
          <div className="rounded-xl bg-brand-gray-soft p-2 sm:rounded-2xl sm:p-3">
            <b className="text-brand-navy">Terikat pasien</b> berarti alat diarahkan ke pasien itu sampai bidan memilih pasien lain.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-gray-border bg-white p-8 text-brand-navy/60 shadow-card">
          <Loader2 className="h-5 w-5 animate-spin" />
          Membaca devices dari Firestore...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-card">
          {error}
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-2xl border border-brand-gray-border bg-white p-6 shadow-card">
          <p className="text-sm text-brand-navy/50">
            Belum ada document di collection <span className="font-semibold">devices</span>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {devices.map((device) => {
            const isBound = Boolean(device.currentPatientId);
            const isMeasuring =
              device.status === 'in_use' && device.sessionStatus === 'active';
            const meaning = getDeviceMeaning(device);

            return (
              <div
                key={device.deviceId}
                className="rounded-2xl border border-brand-gray-border bg-white p-3 shadow-card sm:rounded-3xl sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FBCC25]/25 text-brand-navy sm:h-12 sm:w-12">
                      <Cpu className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold text-brand-navy sm:text-2xl">
                        {device.deviceName || 'Unnamed Device'}
                      </h2>
                      <p className="text-xs text-brand-navy/50">ID: {device.deviceId}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold sm:px-3 sm:text-xs ${statusClass(
                        device.status,
                      )}`}
                    >
                      {device.status || '-'}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold sm:px-3 sm:text-xs ${sessionClass(
                        device.sessionStatus,
                      )}`}
                    >
                      {device.sessionStatus || '-'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-brand-gray-border bg-brand-gray-soft/70 p-3 sm:mt-4 sm:p-4">
                  <div className="flex items-start gap-3">
                    {isMeasuring ? (
                      <Activity className="mt-0.5 h-5 w-5 text-yellow-700" />
                    ) : isBound ? (
                      <Stethoscope className="mt-0.5 h-5 w-5 text-emerald-700" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-navy/45" />
                    )}

                    <div>
                      <p className="font-bold text-brand-navy">{meaning.title}</p>
                      <p className="mt-0.5 text-xs text-brand-navy/55">
                        {meaning.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-2">
                  <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${bindingClass(isBound)}`}>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide sm:text-xs opacity-70">
                      <UserRound className="h-4 w-4" />
                      Pasien Terikat
                    </div>
                    <p className="mt-1 truncate font-bold sm:mt-2">
                      {device.currentPatientName || '-'}
                    </p>
                    <p className="mt-1 truncate text-[10px] opacity-70 sm:text-xs">
                      {device.currentPatientId || 'Belum ada pasien terikat'}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-2xl bg-brand-gray-soft p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide sm:text-xs text-brand-navy/50">
                      <Activity className="h-4 w-4" />
                      Session Aktif
                    </div>
                    <p className="mt-1 break-all font-semibold text-brand-navy sm:mt-2">
                      {device.currentSessionId || '-'}
                    </p>
                    <p className="mt-1 hidden text-xs text-brand-navy/45 sm:block">
                      {device.currentSessionId
                        ? 'Pemeriksaan sedang berjalan'
                        : 'Belum ada pemeriksaan berjalan'}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-2xl bg-brand-gray-soft p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide sm:text-xs text-brand-navy/50">
                      <Battery className="h-4 w-4" />
                      Battery Raw
                    </div>
                    <p className="mt-2 font-semibold text-brand-navy">
                      {formatBattery(device.batteryRaw)}
                    </p>
                  </div>

                  <div className="min-w-0 rounded-2xl bg-brand-gray-soft p-3 sm:p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide sm:text-xs text-brand-navy/50">
                      <Wifi className="h-4 w-4" />
                      WiFi Status
                    </div>
                    <p className="mt-2 font-semibold text-brand-navy">
                      {device.wifiStatus || 'unknown'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-brand-navy/50 sm:mt-4 sm:gap-4 sm:text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-4 w-4" />
                    Last seen: {formatLastSeen(device.lastSeenEpoch)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Radio className="h-4 w-4" />
                    Registered by: {device.registeredBy || '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
