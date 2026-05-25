"use client";

import AppShell from "@/components/AppShell";
import { db } from "@/lib/firebase/client";
import {
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  CalendarDays,
  Download,
  FileText,
  Filter,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type Position = "duduk" | "miring_kiri" | "terlentang" | string;

type Patient = {
  patientId: string;
  patientName: string;
  createdByNurseName?: string;
};

type Session = {
  sessionId: string;
  patientId: string;
  patientName: string;
  nurseName?: string;
  deviceName?: string;
  status?: string;
};

type Measurement = {
  id: string;
  measurementId: string;
  patientId: string;
  sessionId: string;
  deviceId: string;
  position: Position;
  sbp: number | null;
  dbp: number | null;
  bpm: number | null;
  map: number | null;
  rot: number | null;
  batteryRaw: number | null;
  epochTime: number | null;
  uploadedAt?: unknown;
};

type HistoryRow = Measurement & {
  patientName: string;
  nurseName: string;
  deviceName: string;
  sessionStatus: string;
  waktu: string;
  monthKey: string;
  yearKey: string;
  statusLabel: string;
};

const MONTHS = [
  { value: "all", label: "Semua Bulan" },
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getMillis(value: unknown): number {
  if (!value) return 0;

  if (typeof value === "number") {
    return value > 1000000000000 ? value : value * 1000;
  }

  if (
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  return 0;
}

function getMeasurementMillis(measurement: Measurement): number {
  return getMillis(measurement.epochTime) || getMillis(measurement.uploadedAt);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTime(millis: number) {
  if (!millis) return "-";

  const date = new Date(millis);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizePatient(id: string, data: DocumentData): Patient {
  return {
    patientId: String(data.patientId ?? id),
    patientName: String(data.patientName ?? "Tanpa Nama"),
    createdByNurseName:
      typeof data.createdByNurseName === "string"
        ? data.createdByNurseName
        : undefined,
  };
}

function normalizeSession(id: string, data: DocumentData): Session {
  return {
    sessionId: String(data.sessionId ?? id),
    patientId: String(data.patientId ?? ""),
    patientName: String(data.patientName ?? ""),
    nurseName: typeof data.nurseName === "string" ? data.nurseName : undefined,
    deviceName:
      typeof data.deviceName === "string" ? data.deviceName : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
  };
}

function normalizeMeasurement(
  snap: QueryDocumentSnapshot<DocumentData>,
): Measurement {
  const data = snap.data();

  return {
    id: snap.id,
    measurementId: String(data.measurementId ?? snap.id),
    patientId: String(data.patientId ?? ""),
    sessionId: String(data.sessionId ?? snap.ref.parent.parent?.id ?? ""),
    deviceId: String(data.deviceId ?? ""),
    position: String(data.position ?? "-"),
    sbp: numberOrNull(data.sbp),
    dbp: numberOrNull(data.dbp),
    bpm: numberOrNull(data.bpm),
    map: numberOrNull(data.map),
    rot: numberOrNull(data.rot),
    batteryRaw: numberOrNull(data.batteryRaw),
    epochTime: numberOrNull(data.epochTime),
    uploadedAt: data.uploadedAt,
  };
}

function getStatusLabel(row: Pick<Measurement, "sbp" | "dbp" | "rot">) {
  const sbp = row.sbp ?? 0;
  const dbp = row.dbp ?? 0;
  const rot = row.rot ?? null;

  if (sbp >= 160 || dbp >= 110) return "Berat";
  if (sbp >= 140 || dbp >= 90) return "Risiko";
  if (rot !== null && rot >= 20) return "ROT Positif";
  if (rot !== null && rot >= 15) return "ROT Waspada";
  if (sbp >= 120 || dbp >= 80) return "Waspada";

  return "Normal";
}

function getStatusClass(status: string) {
  if (status === "Berat" || status === "Risiko" || status === "ROT Positif") {
    return "bg-red-50 text-red-700";
  }

  if (status === "Waspada" || status === "ROT Waspada") {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-green-50 text-green-700";
}

function downloadExcel(rows: HistoryRow[]) {
  const data = rows.map((row) => ({
    Waktu: row.waktu,
    Pasien: row.patientName,
    Petugas: row.nurseName,
    Device: row.deviceName,
    Posisi: row.position,
    SBP: row.sbp ?? "-",
    DBP: row.dbp ?? "-",
    BPM: row.bpm ?? "-",
    MAP: row.map ?? "-",
    ROT: row.rot ?? "-",
    "Battery Raw": row.batteryRaw ?? "-",
    "Status Klinis": row.statusLabel,
    "Status Session": row.sessionStatus,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat");

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const date = new Date().toISOString().slice(0, 10);

  saveAs(blob, `riwayat-mamacare-${date}.xlsx`);
}

export default function RiwayatPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sortMode, setSortMode] = useState("latest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubPatients = onSnapshot(collection(db, "patients"), (snap) => {
      setPatients(
        snap.docs.map((item) => normalizePatient(item.id, item.data())),
      );
    });

    const unsubSessions = onSnapshot(collectionGroup(db, "sessions"), (snap) => {
      setSessions(
        snap.docs.map((item) => normalizeSession(item.id, item.data())),
      );
    });

    const unsubMeasurements = onSnapshot(
      query(collectionGroup(db, "measurements"), orderBy("uploadedAt", "desc")),
      (snap) => {
        setMeasurements(snap.docs.map(normalizeMeasurement));
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
      },
    );

    return () => {
      unsubPatients();
      unsubSessions();
      unsubMeasurements();
    };
  }, []);

  const rows = useMemo<HistoryRow[]>(() => {
    return measurements.map((measurement) => {
      const patient = patients.find(
        (item) => item.patientId === measurement.patientId,
      );
      const session = sessions.find(
        (item) => item.sessionId === measurement.sessionId,
      );
      const millis = getMeasurementMillis(measurement);
      const date = millis ? new Date(millis) : null;
      const statusLabel = getStatusLabel(measurement);

      return {
        ...measurement,
        patientName:
          session?.patientName || patient?.patientName || measurement.patientId,
        nurseName: session?.nurseName || patient?.createdByNurseName || "-",
        deviceName: session?.deviceName || measurement.deviceId || "-",
        sessionStatus: session?.status || "-",
        waktu: formatDateTime(millis),
        monthKey: date ? pad(date.getMonth() + 1) : "unknown",
        yearKey: date ? String(date.getFullYear()) : "unknown",
        statusLabel,
      };
    });
  }, [measurements, patients, sessions]);

  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(rows.map((row) => row.yearKey).filter((year) => year !== "unknown")),
    ).sort((a, b) => Number(b) - Number(a));

    return years;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const result = rows.filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.patientName.toLowerCase().includes(keyword) ||
        row.nurseName.toLowerCase().includes(keyword) ||
        row.deviceName.toLowerCase().includes(keyword) ||
        row.waktu.toLowerCase().includes(keyword);

      const matchesMonth = monthFilter === "all" || row.monthKey === monthFilter;
      const matchesYear = yearFilter === "all" || row.yearKey === yearFilter;

      return matchesKeyword && matchesMonth && matchesYear;
    });

    return [...result].sort((a, b) => {
      const aTime = getMeasurementMillis(a);
      const bTime = getMeasurementMillis(b);

      return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [rows, search, monthFilter, yearFilter, sortMode]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <h1 className="font-display text-3xl font-bold text-brand-navy lg:text-4xl">
            Riwayat Pengukuran
          </h1>
          <p className="mt-1 text-sm text-brand-navy/55">
            Arsip seluruh hasil tensi pasien yang dikirim dari ESP32.
          </p>
        </div>

        <section className="rounded-3xl border border-brand-gray-border bg-white p-4 shadow-card">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-yellow1/30 text-brand-navy">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-navy">
                Filter Data Pemeriksaan
              </h2>
              <p className="text-xs text-brand-navy/45">
                Cari berdasarkan pasien, petugas, bulan, dan tahun
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_190px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari pasien, petugas, tanggal..."
                className="w-full rounded-xl border border-brand-gray-border bg-brand-gray-soft py-3 pl-11 pr-4 text-sm text-brand-navy outline-none placeholder:text-brand-navy/35 focus:border-[#FBCC25]"
              />
            </div>

            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="rounded-xl border border-brand-gray-border bg-brand-gray-soft px-4 py-3 text-sm font-semibold text-brand-navy outline-none focus:border-[#FBCC25]"
            >
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="rounded-xl border border-brand-gray-border bg-brand-gray-soft px-4 py-3 text-sm font-semibold text-brand-navy outline-none focus:border-[#FBCC25]"
            >
              <option value="all">Semua Tahun</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="rounded-xl border border-brand-gray-border bg-brand-gray-soft px-4 py-3 text-sm font-semibold text-brand-navy outline-none focus:border-[#FBCC25]"
            >
              <option value="latest">Tanggal Terbaru</option>
              <option value="oldest">Tanggal Terlama</option>
            </select>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-bold text-yellow-800">
                Total: {rows.length}
              </span>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                Tampil: {filteredRows.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => downloadExcel(filteredRows)}
              disabled={filteredRows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFB00B] px-4 py-2.5 text-xs font-bold text-brand-navy shadow-sm transition hover:bg-[#FBCC25] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-brand-gray-border bg-white shadow-card">
          <div className="flex items-start gap-3 border-b border-brand-gray-border p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-gray-soft text-brand-navy/60">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-navy">
                Data Pengukuran
              </h2>
              <p className="text-xs text-brand-navy/45">
                {filteredRows.length} data ditemukan
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="animate-spin text-[#FFB00B]" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <CalendarDays className="mb-3 h-10 w-10 text-brand-navy/25" />
              <h3 className="font-display text-xl font-bold text-brand-navy">
                Belum ada data
              </h3>
              <p className="mt-1 text-sm text-brand-navy/45">
                Data akan muncul setelah measurement dikirim.
              </p>
            </div>
          ) : (
            <div className="max-h-[620px] overflow-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-brand-gray-soft uppercase text-brand-navy/45">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Pasien</th>
                    <th className="px-4 py-3">Petugas</th>
                    <th className="px-4 py-3">SBP</th>
                    <th className="px-4 py-3">DBP</th>
                    <th className="px-4 py-3">BPM</th>
                    <th className="px-4 py-3">MAP</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-brand-gray-border text-brand-navy">
                  {filteredRows.map((row) => (
                    <tr
                      key={`${row.sessionId}-${row.measurementId}`}
                      className="transition hover:bg-brand-gray-soft/70"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-brand-navy/65">
                        {row.waktu}
                      </td>
                      <td className="px-4 py-3 font-bold">{row.patientName}</td>
                      <td className="px-4 py-3 text-brand-navy/60">
                        {row.nurseName}
                      </td>
                      <td className="px-4 py-3 font-bold">{row.sbp ?? "-"}</td>
                      <td className="px-4 py-3 font-bold">{row.dbp ?? "-"}</td>
                      <td className="px-4 py-3 text-brand-navy/70">
                        {row.bpm ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-brand-navy/70">
                        {row.map ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${getStatusClass(row.statusLabel)}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
