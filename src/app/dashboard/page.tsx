"use client";

import AppShell from "@/components/AppShell";
import { UI_CONFIG } from "@/config/ui";
import { db } from "@/lib/firebase/client";
import {
  Activity,
  AlertTriangle,
  Battery,
  CheckCircle2,
  Cpu,
  Loader2,
  RefreshCw,
  Stethoscope,
  UsersRound,
  Wifi,
} from "lucide-react";
import {
  collection,
  collectionGroup,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DeviceStatus = "available" | "in_use" | "offline" | string;
type SessionStatus = "active" | "completed" | "cancelled" | string;
type Position = "duduk" | "miring_kiri" | "terlentang" | string;

type Device = {
  id: string;
  deviceId: string;
  deviceName: string;
  status: DeviceStatus;
  currentSessionId: string | null;
  currentPatientId: string | null;
  currentPatientName: string | null;
  sessionStatus: string;
  batteryRaw: number | null;
  wifiStatus: string | null;
  lastSeenEpoch: number | null;
  registeredBy: string | null;
};

type Patient = {
  id: string;
  patientId: string;
  patientName: string;
  createdByNurseId?: string;
  createdByNurseName?: string;
  latestSessionId?: string;
  latestMeasurement?: Measurement | null;
  latestROT?: unknown;
};

type Session = {
  id: string;
  sessionId: string;
  patientId: string;
  patientName: string;
  nurseId: string;
  nurseName: string;
  deviceId: string;
  deviceName: string;
  status: SessionStatus;
  currentPosition: Position;
  positionController: string;
  positionSequence: string[];
  completedPositions: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  completedAt?: unknown;
};

type Measurement = {
  id: string;
  measurementId: string;
  patientId: string;
  sessionId: string;
  deviceId: string;
  position: Position;
  bpm: number | null;
  dbp: number | null;
  sbp: number | null;
  map: number | null;
  rot: number | null;
  batteryRaw: number | null;
  epochTime: number | null;
  uploadedAt?: unknown;
};

type AlertLevel = "normal" | "warning" | "danger" | "critical";

const numberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getMillis = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return 0;
};

const formatTime = (value: unknown) => {
  const millis = getMillis(value);
  if (!millis) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(millis));
};

const mapDevice = (snap: QueryDocumentSnapshot<DocumentData>): Device => {
  const data = snap.data();
  return {
    id: snap.id,
    deviceId: String(data.deviceId ?? snap.id),
    deviceName: String(data.deviceName ?? snap.id),
    status: String(data.status ?? "offline"),
    currentSessionId: data.currentSessionId ?? null,
    currentPatientId: data.currentPatientId ?? null,
    currentPatientName: data.currentPatientName ?? null,
    sessionStatus: String(data.sessionStatus ?? "idle"),
    batteryRaw: numberOrNull(data.batteryRaw),
    wifiStatus: data.wifiStatus ? String(data.wifiStatus) : null,
    lastSeenEpoch: numberOrNull(data.lastSeenEpoch),
    registeredBy: data.registeredBy ? String(data.registeredBy) : null,
  };
};

const mapPatient = (snap: QueryDocumentSnapshot<DocumentData>): Patient => {
  const data = snap.data();
  return {
    id: snap.id,
    patientId: String(data.patientId ?? snap.id),
    patientName: String(data.patientName ?? "-"),
    createdByNurseId: data.createdByNurseId
      ? String(data.createdByNurseId)
      : undefined,
    createdByNurseName: data.createdByNurseName
      ? String(data.createdByNurseName)
      : undefined,
    latestSessionId: data.latestSessionId
      ? String(data.latestSessionId)
      : undefined,
    latestMeasurement: data.latestMeasurement ?? null,
    latestROT: data.latestROT ?? null,
  };
};

const mapSession = (snap: QueryDocumentSnapshot<DocumentData>): Session => {
  const data = snap.data();
  return {
    id: snap.id,
    sessionId: String(data.sessionId ?? snap.id),
    patientId: String(data.patientId ?? ""),
    patientName: String(data.patientName ?? "-"),
    nurseId: String(data.nurseId ?? ""),
    nurseName: String(data.nurseName ?? "-"),
    deviceId: String(data.deviceId ?? ""),
    deviceName: String(data.deviceName ?? "-"),
    status: String(data.status ?? "active"),
    currentPosition: String(data.currentPosition ?? "duduk"),
    positionController: String(data.positionController ?? "device"),
    positionSequence: Array.isArray(data.positionSequence)
      ? data.positionSequence.map(String)
      : [],
    completedPositions: Array.isArray(data.completedPositions)
      ? data.completedPositions.map(String)
      : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    completedAt: data.completedAt,
  };
};

const mapMeasurement = (
  snap: QueryDocumentSnapshot<DocumentData>,
): Measurement => {
  const data = snap.data();
  return {
    id: snap.id,
    measurementId: String(data.measurementId ?? snap.id),
    patientId: String(data.patientId ?? ""),
    sessionId: String(snap.ref.parent.parent?.id ?? data.sessionId ?? ""),
    deviceId: String(data.deviceId ?? ""),
    position: String(data.position ?? "-"),
    bpm: numberOrNull(data.bpm),
    dbp: numberOrNull(data.dbp),
    sbp: numberOrNull(data.sbp),
    map: numberOrNull(data.map),
    rot: numberOrNull(data.rot),
    batteryRaw: numberOrNull(data.batteryRaw),
    epochTime: numberOrNull(data.epochTime),
    uploadedAt: data.uploadedAt,
  };
};

const latestMeasurement = (items: Measurement[]) => {
  return [...items].sort((a, b) => {
    const bTime = b.epochTime ?? getMillis(b.uploadedAt);
    const aTime = a.epochTime ?? getMillis(a.uploadedAt);
    return bTime - aTime;
  })[0];
};

const getClinicalStatus = (measurement?: Measurement | null) => {
  const sbp = measurement?.sbp ?? null;
  const dbp = measurement?.dbp ?? null;
  const map = measurement?.map ?? null;
  const bpm = measurement?.bpm ?? null;
  const rot = measurement?.rot ?? null;

  let level: AlertLevel = "normal";
  const messages: string[] = [];

  if (sbp !== null && dbp !== null) {
    if (sbp >= 180 || dbp >= 120) {
      level = "critical";
      messages.push(
        "Tekanan darah masuk kategori krisis. Perlu evaluasi segera.",
      );
    } else if (sbp >= 160 || dbp >= 110) {
      level = "critical";
      messages.push(
        "Tekanan darah sangat tinggi untuk kehamilan. Perlu perhatian klinis segera.",
      );
    } else if (sbp >= 140 || dbp >= 90) {
      level = "danger";
      messages.push(
        "Tekanan darah tinggi. Pantau risiko hipertensi pada kehamilan.",
      );
    } else if (sbp >= 120 || dbp >= 80) {
      level = "warning";
      messages.push("Tekanan darah mulai meningkat. Lanjutkan pemantauan.");
    } else {
      messages.push("Tekanan darah dalam rentang normal.");
    }
  }

  if (map !== null) {
    if (map < 65) {
      level = level === "critical" ? level : "danger";
      messages.push("MAP rendah. Perlu evaluasi perfusi.");
    } else if (map > 105) {
      if (level === "normal") level = "warning";
      messages.push("MAP meningkat. Perlu pemantauan tekanan rata-rata.");
    }
  }

  if (bpm !== null) {
    if (bpm < 60 || bpm > 100) {
      if (level === "normal") level = "warning";
      messages.push("BPM di luar rentang normal 60–100 denyut/menit.");
    }
  }

  if (rot !== null) {
    if (rot >= 20) {
      level = level === "critical" ? level : "danger";
      messages.push(
        "ROT positif. Ada indikasi risiko hipertensi kehamilan/preeklamsia.",
      );
    } else if (rot >= 15) {
      if (level === "normal") level = "warning";
      messages.push("ROT mendekati batas risiko. Perlu pemantauan ulang.");
    }
  }

  return {
    level,
    label:
      level === "critical"
        ? "Berat"
        : level === "danger"
          ? "Tinggi"
          : level === "warning"
            ? "Waspada"
            : "Normal",
    message: messages[0] ?? "Belum ada data measurement.",
  };
};

const levelClasses: Record<AlertLevel, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  critical: "border-red-300 bg-red-50 text-red-800",
};

export default function DashboardPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubDevices = onSnapshot(collection(db, "devices"), (snap) => {
      setDevices(snap.docs.map(mapDevice));
      setLoading(false);
    });

    const unsubPatients = onSnapshot(collection(db, "patients"), (snap) => {
      setPatients(snap.docs.map(mapPatient));
    });

    const unsubSessions = onSnapshot(
      collectionGroup(db, "sessions"),
      (snap) => {
        setSessions(snap.docs.map(mapSession));
      },
    );

    const unsubMeasurements = onSnapshot(
      collectionGroup(db, "measurements"),
      (snap) => {
        setMeasurements(snap.docs.map(mapMeasurement));
      },
    );

    return () => {
      unsubDevices();
      unsubPatients();
      unsubSessions();
      unsubMeasurements();
    };
  }, []);

  const activeDevices = useMemo(
    () => devices.filter((item) => item.status === "in_use"),
    [devices],
  );
  const availableDevices = useMemo(
    () => devices.filter((item) => item.status === "available"),
    [devices],
  );

  // Hybrid V2 + UX v1:
  // Device status tetap mengikuti alat: in_use saat sedang mengukur, available saat standby.
  // Patient aktif di UI mengikuti device.currentPatientId, sehingga pasien tetap tampil
  // setelah session selesai sampai nurse memilih pasien lain.
  const activeDevice = useMemo(() => {
    return (
      devices.find(
        (item) => item.status === "in_use" && item.currentPatientId,
      ) ??
      devices.find((item) => item.currentPatientId) ??
      null
    );
  }, [devices]);

  const activePatient = useMemo(() => {
    if (!activeDevice?.currentPatientId) return null;
    return (
      patients.find(
        (item) => item.patientId === activeDevice.currentPatientId,
      ) ?? null
    );
  }, [activeDevice?.currentPatientId, patients]);

  const activeSession = useMemo(() => {
    if (!activePatient) return null;

    if (activeDevice?.currentSessionId) {
      const sessionFromDevice = sessions.find(
        (item) =>
          item.sessionId === activeDevice.currentSessionId &&
          item.patientId === activePatient.patientId,
      );
      if (sessionFromDevice) return sessionFromDevice;
    }

    if (activePatient.latestSessionId) {
      const latestSessionFromPatient = sessions.find(
        (item) =>
          item.sessionId === activePatient.latestSessionId &&
          item.patientId === activePatient.patientId,
      );
      if (latestSessionFromPatient) return latestSessionFromPatient;
    }

    const patientSessions = sessions
      .filter((item) => item.patientId === activePatient.patientId)
      .sort((a, b) => getMillis(b.updatedAt) - getMillis(a.updatedAt));

    return patientSessions[0] ?? null;
  }, [activeDevice?.currentSessionId, activePatient, sessions]);

  const positionOrder = useMemo(
    () => ["duduk", "miring_kiri", "terlentang"],
    [],
  );

  const getPositionIndex = (position: string) => {
    const index = positionOrder.indexOf(position);
    return index === -1 ? 99 : index;
  };

  const activeSessionMeasurements = useMemo(() => {
    if (!activeSession) return [];
    return measurements
      .filter((item) => item.sessionId === activeSession.sessionId)
      .sort((a, b) => {
        const byPosition =
          getPositionIndex(a.position) - getPositionIndex(b.position);
        if (byPosition !== 0) return byPosition;

        const aTime = a.epochTime ?? getMillis(a.uploadedAt);
        const bTime = b.epochTime ?? getMillis(b.uploadedAt);
        return aTime - bTime;
      });
  }, [activeSession, measurements]);

  const patientMeasurements = useMemo(() => {
    if (!activePatient) return [];

    return measurements
      .filter((item) => item.patientId === activePatient.patientId)
      .sort((a, b) => {
        const bTime = b.epochTime ?? getMillis(b.uploadedAt);
        const aTime = a.epochTime ?? getMillis(a.uploadedAt);
        return bTime - aTime;
      });
  }, [activePatient, measurements]);

  const fallbackSessionId = useMemo(() => {
    if (activeSessionMeasurements.length > 0) return null;

    const latestPatientMeasurement = patientMeasurements[0];

    return latestPatientMeasurement?.sessionId ?? null;
  }, [activeSessionMeasurements.length, patientMeasurements]);

  const fallbackSessionMeasurements = useMemo(() => {
    if (!fallbackSessionId) return [];

    return measurements
      .filter((item) => item.sessionId === fallbackSessionId)
      .sort((a, b) => {
        const byPosition =
          getPositionIndex(a.position) - getPositionIndex(b.position);
        if (byPosition !== 0) return byPosition;

        const aTime = a.epochTime ?? getMillis(a.uploadedAt);
        const bTime = b.epochTime ?? getMillis(b.uploadedAt);
        return aTime - bTime;
      });
  }, [fallbackSessionId, measurements]);

  const displayMeasurements = useMemo(() => {
    return activeSessionMeasurements.length > 0
      ? activeSessionMeasurements
      : fallbackSessionMeasurements;
  }, [activeSessionMeasurements, fallbackSessionMeasurements]);

  const isShowingPreviousMeasurement =
    Boolean(activeSession) &&
    activeSessionMeasurements.length === 0 &&
    displayMeasurements.length > 0;

  const measurementPositions = useMemo(() => {
    const uniquePositions = new Set<string>();

    activeSessionMeasurements.forEach((item) => {
      if (positionOrder.includes(item.position)) {
        uniquePositions.add(item.position);
      }
    });

    return positionOrder.filter((position) => uniquePositions.has(position));
  }, [activeSessionMeasurements, positionOrder]);

  const completedPositions = useMemo(() => {
    const sessionPositions = Array.isArray(activeSession?.completedPositions)
      ? activeSession.completedPositions.filter((position) =>
        positionOrder.includes(position),
      )
      : [];

    const merged = new Set([...sessionPositions, ...measurementPositions]);
    return positionOrder.filter((position) => merged.has(position));
  }, [activeSession?.completedPositions, measurementPositions, positionOrder]);

  const totalPositions =
    activeSession?.positionSequence?.length || positionOrder.length;
  const completedCount = Math.min(completedPositions.length, totalPositions);

  const computedPosition = useMemo(() => {
    if (!activeSession) return "-";
    if (completedCount >= totalPositions) return "selesai";

    const nextPosition =
      positionOrder[completedCount] ?? activeSession.currentPosition ?? "duduk";
    return `${nextPosition} (${completedCount + 1}/${totalPositions})`;
  }, [activeSession, completedCount, totalPositions, positionOrder]);

  const latest = useMemo(
    () => latestMeasurement(displayMeasurements),
    [displayMeasurements],
  );

  const rotMeasurement = useMemo(() => {
    return (
      displayMeasurements.find(
        (item) => item.position === "terlentang" && item.rot !== null,
      ) ??
      displayMeasurements.find((item) => item.rot !== null) ??
      null
    );
  }, [displayMeasurements]);

  const displayedMeasurement = useMemo(() => {
    return rotMeasurement ?? latest ?? null;
  }, [rotMeasurement, latest]);

  const clinical = useMemo(
    () => getClinicalStatus(displayedMeasurement),
    [displayedMeasurement],
  );

  const displayPatientName =
    activePatient?.patientName ?? activeDevice?.currentPatientName ?? "-";
  const displaySessionId =
    activeSession?.sessionId ?? activePatient?.latestSessionId ?? "-";
  const displayDeviceName =
    activeSession?.deviceName ?? activeDevice?.deviceName ?? "-";
  const displayNurseName =
    activeSession?.nurseName ?? activePatient?.createdByNurseName ?? "-";
  const displayPosition = activeSession ? computedPosition : "-";
  const displayTotalPositions =
    activeSession?.positionSequence?.length || positionOrder.length;

  const stats = [
    { label: "Total Device", value: devices.length, icon: Cpu },
    { label: "Device Aktif", value: activeDevices.length, icon: Activity },
    { label: "Pasien", value: patients.length, icon: UsersRound },
  ];

  return (
    <AppShell>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight text-brand-navy lg:text-4xl">
            Dashboard MamaCare V2
          </h1>
          <p className="mt-1 text-sm text-brand-navy/60">
            Monitoring pasien yang sedang diset aktif oleh nurse secara
            realtime.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {UI_CONFIG.SHOW_ADD_PATIENT_IN_DASHBOARD && (
            <button
              type="button"
              onClick={() => router.push("/patients")}
              className="rounded-2xl bg-[#FBCC25] px-4 py-2 text-xs font-bold text-brand-navy shadow-sm transition hover:bg-[#FFB00B]"
            >
              + Tambah Pasien
            </button>
          )}

          <div className="flex items-center gap-2 rounded-2xl border border-brand-gray-border bg-white px-4 py-2 text-xs font-semibold text-brand-navy/65 shadow-card">
            <RefreshCw size={14} /> Realtime Firestore
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-brand-gray-border bg-white shadow-card">
          <Loader2 className="animate-spin text-brand-yellow2" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-brand-gray-border bg-white p-4 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/45">
                      {label}
                    </p>
                    <p className="font-display mt-1 text-3xl font-bold text-brand-navy">
                      {value}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow1/25 text-brand-yellow2">
                    <Icon size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
            <section className="rounded-3xl border border-brand-gray-border bg-white p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-brand-navy">
                    Device
                  </h2>
                  <p className="text-xs text-brand-navy/50">
                    {availableDevices.length} available · {activeDevices.length}{" "}
                    in use
                  </p>
                </div>
                <Cpu className="text-brand-yellow2" size={22} />
              </div>

              <div className="space-y-3">
                {devices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brand-gray-border p-5 text-center text-sm text-brand-navy/50">
                    Belum ada device terdaftar.
                  </div>
                ) : (
                  devices.map((device) => (
                    <div
                      key={device.id}
                      className="rounded-2xl border border-brand-gray-border bg-brand-gray-soft p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-display text-lg font-bold text-brand-navy">
                            {device.deviceName}
                          </p>
                          <p className="text-xs text-brand-navy/45">
                            ID: {device.deviceId}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${device.status === "in_use"
                            ? "bg-yellow-100 text-yellow-700"
                            : device.status === "available"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                            }`}
                        >
                          {device.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white p-2">
                          <p className="text-brand-navy/40">Pasien</p>
                          <p className="truncate font-semibold text-brand-navy">
                            {device.currentPatientName ?? "-"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white p-2">
                          <p className="text-brand-navy/40">Session</p>
                          <p className="truncate font-semibold text-brand-navy">
                            {device.currentSessionId ?? "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white p-2">
                          <Battery size={14} className="text-brand-navy/35" />
                          <span className="font-semibold text-brand-navy">
                            {device.batteryRaw ?? "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-white p-2">
                          <Wifi size={14} className="text-brand-navy/35" />
                          <span className="font-semibold text-brand-navy">
                            {device.wifiStatus ?? "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-brand-gray-border bg-white p-4 shadow-card">
              {!activePatient ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-brand-gray-border text-center">
                  <CheckCircle2 className="mb-3 text-emerald-500" size={38} />
                  <h2 className="font-display text-2xl font-bold text-brand-navy">
                    Tidak ada pasien aktif
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-brand-navy/55">
                    Pilih pasien di halaman Pasien. Pasien akan tetap aktif
                    sampai nurse memilih pasien lain.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-yellow1/25 text-brand-navy">
                          <Stethoscope size={22} />
                        </div>
                        <div>
                          <h2 className="font-display text-2xl font-bold text-brand-navy">
                            {displayPatientName}
                          </h2>
                          <p className="text-xs text-brand-navy/45">
                            Pasien aktif dari device:{" "}
                            {activeDevice?.deviceName ?? displayDeviceName}
                          </p>
                          <p className="text-xs text-brand-navy/45">
                            Session: {displaySessionId}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${levelClasses[clinical.level]}`}
                    >
                      {clinical.label}
                    </span>
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                    <div className="rounded-2xl bg-brand-gray-soft p-3">
                      <p className="text-xs text-brand-navy/40">Device</p>
                      <p className="font-bold text-brand-navy">
                        {displayDeviceName}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-gray-soft p-3">
                      <p className="text-xs text-brand-navy/40">Nurse</p>
                      <p className="font-bold text-brand-navy">
                        {displayNurseName}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-gray-soft p-3">
                      <p className="text-xs text-brand-navy/40">Posisi</p>
                      <p className="font-bold text-brand-navy">
                        {displayPosition}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-gray-soft p-3">
                      <p className="text-xs text-brand-navy/40">Progress</p>
                      <p className="font-bold text-brand-navy">
                        {completedCount}/{displayTotalPositions} selesai
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mb-3 rounded-2xl border p-3 ${levelClasses[clinical.level]}`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={18} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-bold">Peringatan Klinis</p>
                        <p className="text-xs opacity-90">{clinical.message}</p>
                      </div>
                    </div>
                  </div>

                  {isShowingPreviousMeasurement && (
                    <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                      Session aktif belum memiliki data baru. Dashboard sementara menampilkan hasil pemeriksaan terakhir pasien ini.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
                    <div className="rounded-2xl border border-brand-gray-border bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">
                        Tekanan Darah
                      </p>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="font-display text-6xl font-bold leading-none text-brand-navy">
                          {displayedMeasurement?.sbp ?? "-"}
                        </span>
                        <span className="pb-2 text-4xl font-bold text-brand-navy/45">
                          /
                        </span>
                        <span className="font-display text-5xl font-bold leading-none text-brand-navy/55">
                          {displayedMeasurement?.dbp ?? "-"}
                        </span>
                        <span className="pb-2 text-xs font-semibold text-brand-navy/45">
                          mmHg
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-brand-gray-border bg-brand-gray-soft p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">
                          BPM
                        </p>
                        <p className="mt-2 text-3xl font-bold text-brand-navy">
                          {displayedMeasurement?.bpm ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-brand-gray-border bg-brand-gray-soft p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">
                          MAP
                        </p>
                        <p className="mt-2 text-3xl font-bold text-brand-navy">
                          {displayedMeasurement?.map ?? "-"}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-2xl border border-brand-gray-border bg-emerald-50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700/70">
                          ROT
                        </p>
                        <p className="mt-1 text-4xl font-bold text-emerald-700">
                          {rotMeasurement?.rot !== null &&
                            rotMeasurement?.rot !== undefined
                            ? `+${rotMeasurement.rot}`
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-2xl border border-brand-gray-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-brand-gray-soft text-[11px] uppercase text-brand-navy/45">
                        <tr>
                          <th className="px-3 py-2">Posisi</th>
                          <th className="px-3 py-2">SBP</th>
                          <th className="px-3 py-2">DBP</th>
                          <th className="px-3 py-2">BPM</th>
                          <th className="px-3 py-2">MAP</th>
                          <th className="px-3 py-2">ROT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayMeasurements.length === 0 ? (
                          <tr>
                            <td
                              className="px-3 py-4 text-center text-brand-navy/45"
                              colSpan={6}
                            >
                              Belum ada measurement untuk pasien ini.
                            </td>
                          </tr>
                        ) : (
                          displayMeasurements.map((item) => (
                            <tr
                              key={item.id}
                              className="border-t border-brand-gray-border"
                            >
                              <td className="px-3 py-2 font-semibold text-brand-navy">
                                {item.position}
                              </td>
                              <td className="px-3 py-2 text-brand-navy/70">
                                {item.sbp ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-brand-navy/70">
                                {item.dbp ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-brand-navy/70">
                                {item.bpm ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-brand-navy/70">
                                {item.map ?? "-"}
                              </td>
                              <td className="px-3 py-2 text-brand-navy/70">
                                {item.rot ?? "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-2 text-xs text-brand-navy/40">
                    Update terakhir:{" "}
                    {formatTime(displayedMeasurement?.uploadedAt)}
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}
