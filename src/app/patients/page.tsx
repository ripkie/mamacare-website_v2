"use client";

import AppShell from "@/components/AppShell";
import { UI_CONFIG } from "@/config/ui";
import { db } from "@/lib/firebase/client";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Unsubscribe,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  Baby,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  Loader2,
  MonitorCog,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DeviceStatus = "available" | "in_use" | "offline";
type SessionStatus = "active" | "completed" | "cancelled";
type Position = "duduk" | "miring_kiri" | "terlentang";

type Patient = {
  patientId: string;
  patientName: string;
  createdByNurseId?: string;
  createdByNurseName?: string;
  latestSessionId?: string | null;
  latestMeasurement?: Measurement | null;
  latestROT?: unknown | null;
};

type Device = {
  deviceId: string;
  deviceName: string;
  status: DeviceStatus;
  currentSessionId?: string | null;
  currentPatientId?: string | null;
  currentPatientName?: string | null;
  sessionStatus?: "idle" | "active" | "completed" | "cancelled";
  batteryRaw?: number | null;
  wifiStatus?: string | null;
  lastSeenEpoch?: number | null;
  registeredBy?: string | null;
};

type Session = {
  sessionId: string;
  patientId: string;
  patientName: string;
  nurseId?: string;
  nurseName?: string;
  deviceId?: string;
  deviceName?: string;
  status: SessionStatus;
  currentPosition?: Position;
  positionController?: string;
  positionSequence?: Position[];
  completedPositions?: Position[];
  createdAt?: unknown;
  updatedAt?: unknown;
  completedAt?: unknown | null;
};

type Measurement = {
  measurementId: string;
  patientId: string;
  sessionId: string;
  deviceId: string;
  position: Position;
  bpm: number;
  dbp: number;
  sbp: number;
  map: number;
  rot: number | null;
  batteryRaw?: number | null;
  epochTime?: number | null;
  uploadedAt?: unknown;
};

type PatientView = {
  patient: Patient;
  latestSession: Session | null;
  sessions: Session[];
  measurements: Measurement[];
  allMeasurements: Measurement[];
};

const POSITIONS: Position[] = ["duduk", "miring_kiri", "terlentang"];

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function formatCounter(num: number) {
  return String(num).padStart(3, "0");
}

function normalizeMeasurement(
  id: string,
  data: Record<string, unknown>,
): Measurement {
  return {
    measurementId: String(data.measurementId ?? id),
    patientId: String(data.patientId ?? ""),
    sessionId: String(data.sessionId ?? ""),
    deviceId: String(data.deviceId ?? ""),
    position: String(data.position ?? "duduk") as Position,
    bpm: asNumber(data.bpm) ?? 0,
    dbp: asNumber(data.dbp) ?? 0,
    sbp: asNumber(data.sbp) ?? 0,
    map: asNumber(data.map) ?? 0,
    rot: asNumber(data.rot),
    batteryRaw: asNumber(data.batteryRaw),
    epochTime: asNumber(data.epochTime),
    uploadedAt: data.uploadedAt,
  };
}

function normalizeSession(id: string, data: Record<string, unknown>): Session {
  return {
    sessionId: String(data.sessionId ?? id),
    patientId: String(data.patientId ?? ""),
    patientName: String(data.patientName ?? ""),
    nurseId: typeof data.nurseId === "string" ? data.nurseId : undefined,
    nurseName: typeof data.nurseName === "string" ? data.nurseName : undefined,
    deviceId: typeof data.deviceId === "string" ? data.deviceId : undefined,
    deviceName:
      typeof data.deviceName === "string" ? data.deviceName : undefined,
    status: String(data.status ?? "active") as SessionStatus,
    currentPosition: String(data.currentPosition ?? "duduk") as Position,
    positionController:
      typeof data.positionController === "string"
        ? data.positionController
        : "device",
    positionSequence: Array.isArray(data.positionSequence)
      ? (data.positionSequence as Position[])
      : POSITIONS,
    completedPositions: Array.isArray(data.completedPositions)
      ? (data.completedPositions as Position[])
      : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    completedAt: data.completedAt ?? null,
  };
}

function normalizePatient(id: string, data: Record<string, unknown>): Patient {
  return {
    patientId: String(data.patientId ?? id),
    patientName: String(data.patientName ?? "Tanpa Nama"),
    createdByNurseId:
      typeof data.createdByNurseId === "string"
        ? data.createdByNurseId
        : undefined,
    createdByNurseName:
      typeof data.createdByNurseName === "string"
        ? data.createdByNurseName
        : undefined,
    latestSessionId:
      typeof data.latestSessionId === "string" ? data.latestSessionId : null,
    latestMeasurement:
      data.latestMeasurement && typeof data.latestMeasurement === "object"
        ? normalizeMeasurement(
          "latestMeasurement",
          data.latestMeasurement as Record<string, unknown>,
        )
        : null,
    latestROT: data.latestROT ?? null,
  };
}

function normalizeDevice(id: string, data: Record<string, unknown>): Device {
  return {
    deviceId: String(data.deviceId ?? id),
    deviceName: String(data.deviceName ?? id),
    status: String(data.status ?? "available") as DeviceStatus,
    currentSessionId:
      typeof data.currentSessionId === "string" ? data.currentSessionId : null,
    currentPatientId:
      typeof data.currentPatientId === "string" ? data.currentPatientId : null,
    currentPatientName:
      typeof data.currentPatientName === "string"
        ? data.currentPatientName
        : null,
    sessionStatus: String(
      data.sessionStatus ?? "idle",
    ) as Device["sessionStatus"],
    batteryRaw: asNumber(data.batteryRaw),
    wifiStatus: typeof data.wifiStatus === "string" ? data.wifiStatus : null,
    lastSeenEpoch: asNumber(data.lastSeenEpoch),
    registeredBy:
      typeof data.registeredBy === "string" ? data.registeredBy : null,
  };
}


function getTimestampMillis(value: unknown): number {
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
  return (
    getTimestampMillis(measurement.epochTime) ||
    getTimestampMillis(measurement.uploadedAt)
  );
}

function formatMeasurementDate(measurement?: Measurement | null): string {
  if (!measurement) return "-";

  const millis = getMeasurementMillis(measurement);
  if (!millis) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(millis));
}

function getMeasurementStatus(measurement: Measurement) {
  if (measurement.sbp >= 160 || measurement.dbp >= 110) {
    return {
      label: "Berat",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (measurement.sbp >= 140 || measurement.dbp >= 90) {
    return {
      label: "Risiko",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  if (measurement.sbp >= 120 || measurement.dbp >= 80) {
    return {
      label: "Waspada",
      className: "border-yellow-200 bg-yellow-50 text-yellow-700",
    };
  }

  return {
    label: "Normal",
    className: "border-green-200 bg-green-50 text-green-700",
  };
}

function getRotStatus(rot: number | null) {
  if (rot === null) {
    return {
      label: "-",
      className: "border-brand-gray-border bg-brand-gray-soft text-brand-navy/50",
    };
  }

  if (rot >= 20) {
    return {
      label: "ROT Positif",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (rot >= 15) {
    return {
      label: "ROT Waspada",
      className: "border-yellow-200 bg-yellow-50 text-yellow-700",
    };
  }

  return {
    label: "Negatif",
    className: "border-green-200 bg-green-50 text-green-700",
  };
}

async function loadPatientDetails(patient: Patient): Promise<PatientView> {
  const sessionsRef = collection(db, "patients", patient.patientId, "sessions");
  const sessionsSnap = await getDocs(sessionsRef);
  const sessions = sessionsSnap.docs
    .map((item) => normalizeSession(item.id, item.data()))
    .sort(
      (a, b) =>
        getTimestampMillis(b.createdAt) -
        getTimestampMillis(a.createdAt),
    );

  const allMeasurementsNested = await Promise.all(
    sessions.map(async (session) => {
      const measurementsRef = collection(
        db,
        "patients",
        patient.patientId,
        "sessions",
        session.sessionId,
        "measurements",
      );

      const measurementsSnap = await getDocs(measurementsRef);

      return measurementsSnap.docs.map((item) => {
        const measurement = normalizeMeasurement(item.id, item.data());

        return {
          ...measurement,
          sessionId: measurement.sessionId || session.sessionId,
        };
      });
    }),
  );

  const allMeasurements = allMeasurementsNested
    .flat()
    .sort((a, b) => getMeasurementMillis(b) - getMeasurementMillis(a));

  const latestSession =
    sessions.find((session) => session.sessionId === patient.latestSessionId) ??
    sessions.find((session) => session.status === "active") ??
    sessions[0] ??
    null;

  const measurements = latestSession
    ? allMeasurements
      .filter((measurement) => measurement.sessionId === latestSession.sessionId)
      .sort(
        (a, b) =>
          POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position),
      )
    : [];

  return { patient, latestSession, sessions, measurements, allMeasurements };
}

function getLatestMeasurement(view: PatientView): Measurement | null {
  return (
    view.measurements[view.measurements.length - 1] ??
    view.patient.latestMeasurement ??
    null
  );
}

type ClinicalLevel = "normal" | "warning" | "danger" | "critical";

type ClinicalAssessment = {
  level: ClinicalLevel;
  label: string;
  title: string;
  message: string;
  bpLabel: string;
  mapLabel: string;
  rotLabel: string;
  bpmLabel: string;
  rotValue: number | null;
  miringDbp: number | null;
  terlentangDbp: number | null;
};

function getLevelRank(level: ClinicalLevel) {
  return { normal: 0, warning: 1, danger: 2, critical: 3 }[level];
}

function pickWorst(a: ClinicalLevel, b: ClinicalLevel): ClinicalLevel {
  return getLevelRank(b) > getLevelRank(a) ? b : a;
}

function getLatestByPosition(
  measurements: Measurement[],
  position: Position,
): Measurement | null {
  return (
    [...measurements]
      .reverse()
      .find((measurement) => measurement.position === position) ?? null
  );
}

function assessClinical(
  view: PatientView | null,
  latest: Measurement | null,
): ClinicalAssessment | null {
  if (!view || !latest) return null;

  const miring = getLatestByPosition(view.measurements, "miring_kiri");
  const terlentang = getLatestByPosition(view.measurements, "terlentang");
  const miringDbp = miring?.dbp ?? null;
  const terlentangDbp = terlentang?.dbp ?? null;
  const rotValue =
    latest.rot ??
    (miringDbp !== null && terlentangDbp !== null
      ? terlentangDbp - miringDbp
      : null);

  let level: ClinicalLevel = "normal";
  let bpLabel = "Normal";
  let mapLabel = "Normal";
  let rotLabel = "ROT Negatif";
  let bpmLabel = "Normal";
  const notes: string[] = [];

  if (latest.sbp >= 180 || latest.dbp >= 120) {
    level = pickWorst(level, "critical");
    bpLabel = "Krisis";
    notes.push("Tekanan darah masuk kategori krisis. Perlu evaluasi segera.");
  } else if (latest.sbp >= 160 || latest.dbp >= 110) {
    level = pickWorst(level, "critical");
    bpLabel = "Berat";
    notes.push(
      "Tekanan darah mencapai rentang berat pada kehamilan. Perlu perhatian klinis segera.",
    );
  } else if (latest.sbp >= 140 || latest.dbp >= 90) {
    level = pickWorst(level, "danger");
    bpLabel = "Tinggi";
    notes.push(
      "Tekanan darah tinggi. Perlu monitoring dan evaluasi petugas kesehatan.",
    );
  } else if (latest.sbp >= 130 || latest.dbp >= 80) {
    level = pickWorst(level, "warning");
    bpLabel = "Waspada";
    notes.push("Tekanan darah mulai meningkat. Lanjutkan observasi.");
  } else if (latest.sbp >= 120 && latest.dbp < 80) {
    level = pickWorst(level, "warning");
    bpLabel = "Elevated";
    notes.push("Tekanan sistolik meningkat. Lanjutkan observasi.");
  }

  if (latest.map > 105) {
    level = pickWorst(level, "danger");
    mapLabel = "MAP Tinggi";
    notes.push("MAP tinggi, menunjukkan tekanan arteri rata-rata meningkat.");
  } else if (latest.map < 65 && latest.map > 0) {
    level = pickWorst(level, "danger");
    mapLabel = "MAP Rendah";
    notes.push("MAP rendah, perlu evaluasi perfusi.");
  }

  if (rotValue !== null) {
    if (rotValue >= 20) {
      level = pickWorst(level, "danger");
      rotLabel = "ROT Positif";
      notes.push(
        "ROT positif, terdapat peningkatan DBP terlentang dibanding miring kiri.",
      );
    } else if (rotValue >= 15) {
      level = pickWorst(level, "warning");
      rotLabel = "ROT Waspada";
      notes.push("ROT mendekati batas positif. Disarankan observasi ulang.");
    }
  }

  if (latest.bpm > 100) {
    level = pickWorst(level, "warning");
    bpmLabel = "BPM Tinggi";
    notes.push("Denyut jantung meningkat.");
  } else if (latest.bpm > 0 && latest.bpm < 60) {
    level = pickWorst(level, "warning");
    bpmLabel = "BPM Rendah";
    notes.push("Denyut jantung rendah.");
  }

  const statusMap: Record<
    ClinicalLevel,
    { label: string; title: string; message: string }
  > = {
    normal: {
      label: "Normal",
      title: "Kondisi stabil",
      message:
        "Pemeriksaan terbaru tidak menunjukkan tanda risiko tinggi berdasarkan data saat ini.",
    },
    warning: {
      label: "Waspada",
      title: "Perlu observasi",
      message: notes.join(" "),
    },
    danger: {
      label: "Risiko",
      title: "Perlu perhatian klinis",
      message: notes.join(" "),
    },
    critical: {
      label: "Berat",
      title: "Perlu perhatian klinis segera",
      message: notes.join(" "),
    },
  };

  return {
    level,
    label: statusMap[level].label,
    title: statusMap[level].title,
    message: statusMap[level].message,
    bpLabel,
    mapLabel,
    rotLabel,
    bpmLabel,
    rotValue,
    miringDbp,
    terlentangDbp,
  };
}

function getAssessmentClasses(level: ClinicalLevel) {
  if (level === "normal") return "border-green-200 bg-green-50 text-green-700";
  if (level === "warning")
    return "border-yellow-200 bg-yellow-50 text-yellow-800";
  if (level === "danger")
    return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-red-200 bg-red-50 text-red-700";
}

function getPanelClasses(level: ClinicalLevel) {
  if (level === "normal") return "border-green-100 bg-green-50/50";
  if (level === "warning") return "border-yellow-100 bg-yellow-50/50";
  if (level === "danger") return "border-orange-100 bg-orange-50/50";
  return "border-red-100 bg-red-50/50";
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );
  const [setActivePatient, setSetActivePatient] = useState<PatientView | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isStartingExam, setIsStartingExam] = useState(false);
  const [isCancellingExam, setIsCancellingExam] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newNurseName, setNewNurseName] = useState("Bidan Test");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribers: Unsubscribe[] = [];

    const patientsUnsubscribe = onSnapshot(
      collection(db, "patients"),
      async (snapshot) => {
        setIsLoading(true);
        try {
          const basePatients = snapshot.docs.map((item) =>
            normalizePatient(item.id, item.data()),
          );
          const fullPatients = await Promise.all(
            basePatients.map(loadPatientDetails),
          );
          const sorted = fullPatients.sort((a, b) =>
            a.patient.patientName.localeCompare(b.patient.patientName),
          );
          setPatients(sorted);
          setSelectedPatientId(
            (current) => current ?? sorted[0]?.patient.patientId ?? null,
          );
        } catch (error) {
          console.error(error);
          setMessage(
            "Gagal membaca data pasien dari Firestore. Cek console untuk detail error.",
          );
        } finally {
          setIsLoading(false);
        }
      },
    );

    const devicesUnsubscribe = onSnapshot(
      query(collection(db, "devices"), orderBy("deviceName")),
      (snapshot) => {
        setDevices(
          snapshot.docs.map((item) => normalizeDevice(item.id, item.data())),
        );
      },
    );

    unsubscribers.push(patientsUnsubscribe, devicesUnsubscribe);

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const availableDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.status === "available" && device.sessionStatus !== "active",
      ),
    [devices],
  );

  // Hybrid V2 + UX v1:
  // Pasien aktif di UI ditentukan dari device.currentPatientId.
  // Device boleh available setelah sesi selesai, tetapi currentPatientId tetap menyimpan pasien terakhir
  // sampai nurse memilih pasien lain.
  const activePatientDevice = useMemo(
    () => devices.find((device) => Boolean(device.currentPatientId)) ?? null,
    [devices],
  );

  const activePatientId = activePatientDevice?.currentPatientId ?? null;

  useEffect(() => {
    if (activePatientId) {
      setSelectedPatientId(activePatientId);
    }
  }, [activePatientId]);

  const filteredPatients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return patients;

    return patients.filter((view) => {
      const nurse = view.patient.createdByNurseName ?? "";
      return (
        view.patient.patientName.toLowerCase().includes(keyword) ||
        view.patient.patientId.toLowerCase().includes(keyword) ||
        nurse.toLowerCase().includes(keyword)
      );
    });
  }, [patients, search]);

  const selectedPatient =
    patients.find((view) => view.patient.patientId === selectedPatientId) ??
    filteredPatients[0] ??
    patients[0] ??
    null;

  async function activatePatientOnDevice(device: Device) {
    if (!setActivePatient) return;

    setIsActivating(true);
    setMessage(null);

    try {
      const patient = setActivePatient.patient;
      const sessionsSnap = await getDocs(
        collection(db, "patients", patient.patientId, "sessions"),
      );
      const counter = formatCounter(sessionsSnap.size + 1);
      const epoch = Date.now();
      const sessionId = `${epoch}_${device.deviceName}_${counter}`;

      const sessionData = {
        sessionId,
        patientId: patient.patientId,
        patientName: patient.patientName,
        nurseId: patient.createdByNurseId ?? "manualUid",
        nurseName: patient.createdByNurseName ?? "Manual Nurse",
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        status: "active",
        currentPosition: "duduk",
        positionController: "device",
        positionSequence: POSITIONS,
        completedPositions: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completedAt: null,
      };

      await setDoc(
        doc(db, "patients", patient.patientId, "sessions", sessionId),
        sessionData,
      );

      await updateDoc(doc(db, "patients", patient.patientId), {
        latestSessionId: sessionId,
        latestMeasurement: null,
        latestROT: null,
      });

      await updateDoc(doc(db, "devices", device.deviceId), {
        status: "in_use",
        currentSessionId: sessionId,
        currentPatientId: patient.patientId,
        currentPatientName: patient.patientName,
        sessionStatus: "active",
      });

      setSetActivePatient(null);
      setSelectedPatientId(patient.patientId);
      setMessage(
        `Session aktif dibuat untuk ${patient.patientName} di device ${device.deviceName}.`,
      );
    } catch (error) {
      console.error(error);
      setMessage("Gagal set aktif. Cek Firestore Rules dan console browser.");
    } finally {
      setIsActivating(false);
    }
  }

  async function createPatient() {
    const patientName = newPatientName.trim();
    const nurseName = newNurseName.trim();

    if (!patientName) {
      setMessage("Nama pasien wajib diisi.");
      return;
    }

    setIsCreatingPatient(true);
    setMessage(null);

    try {
      const epoch = Date.now();
      const counter = formatCounter(patients.length + 1);
      const patientId = `${epoch}_${counter}`;

      const patientData = {
        patientId,
        patientName,
        createdByNurseId: "manualUid",
        createdByNurseName: nurseName || "Manual Nurse",
        latestSessionId: null,
        latestMeasurement: null,
        latestROT: null,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "patients", patientId), patientData);

      setSelectedPatientId(patientId);
      setNewPatientName("");
      setNewNurseName("Bidan Test");
      setIsAddPatientOpen(false);
      setMessage(`Pasien ${patientName} berhasil ditambahkan.`);
    } catch (error) {
      console.error(error);
      setMessage("Gagal menambah pasien. Cek Firestore Rules dan console browser.");
    } finally {
      setIsCreatingPatient(false);
    }
  }

  async function startExamination() {
    if (!activePatientDevice || !selectedPatient) return;

    setIsStartingExam(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sessions/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: activePatientDevice.deviceId,
          nurseId: selectedPatient.patient.createdByNurseId ?? "uid123",
          nurseName: selectedPatient.patient.createdByNurseName ?? "Bidan Test",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Gagal mulai pemeriksaan.");
      }

      setMessage(
        `Pemeriksaan dimulai untuk ${selectedPatient.patient.patientName}. Posisi awal: duduk.`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Gagal mulai pemeriksaan. Cek console browser.",
      );
    } finally {
      setIsStartingExam(false);
    }
  }

  async function cancelExamination() {
    if (!activePatientDevice || !selectedPatient || !activePatientDevice.currentSessionId) {
      return;
    }

    const confirmed = window.confirm(
      "Batalkan pemeriksaan yang sedang berjalan? Device akan kembali available dan pasien tetap aktif.",
    );

    if (!confirmed) return;

    setIsCancellingExam(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sessions/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: activePatientDevice.deviceId,
          patientId: selectedPatient.patient.patientId,
          sessionId: activePatientDevice.currentSessionId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Gagal cancel pemeriksaan.");
      }

      setMessage(
        `Pemeriksaan untuk ${selectedPatient.patient.patientName} berhasil dibatalkan.`,
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Gagal cancel pemeriksaan. Cek console browser.",
      );
    } finally {
      setIsCancellingExam(false);
    }
  }

  const latest = selectedPatient ? getLatestMeasurement(selectedPatient) : null;
  const assessment = assessClinical(selectedPatient, latest);
  const measurementHistory = selectedPatient?.allMeasurements ?? [];
  const rotHistory = measurementHistory.filter(
    (measurement) => measurement.position === "terlentang" || measurement.rot !== null,
  );
  const isSelectedActive = selectedPatient?.patient.patientId === activePatientId;
  const canStartExamination =
    Boolean(isSelectedActive) &&
    Boolean(activePatientDevice) &&
    activePatientDevice?.status === "available" &&
    activePatientDevice?.sessionStatus !== "active";
  const isDeviceMeasuring =
    Boolean(isSelectedActive) &&
    activePatientDevice?.status === "in_use" &&
    activePatientDevice?.sessionStatus === "active";
  const canCancelExamination =
    Boolean(isDeviceMeasuring) &&
    Boolean(activePatientDevice?.currentSessionId);

  return (
    <AppShell>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-navy">
            Daftar Pasien
          </h1>
          <p className="mt-0.5 text-sm text-brand-navy/60">
            Pilih pasien, lihat pemeriksaan terakhir, lalu mulai pemeriksaan.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari pasien atau petugas..."
              className="w-full rounded-2xl border border-brand-gray-border bg-white py-2.5 pl-11 pr-4 text-sm text-brand-navy outline-none shadow-sm placeholder:text-brand-navy/35 focus:border-[#FBCC25] sm:w-72"
            />
          </div>
          {UI_CONFIG.SHOW_ADD_PATIENT_IN_PATIENTS && (
            <button
              type="button"
              onClick={() => setIsAddPatientOpen(true)}
              className="rounded-2xl bg-[#FBCC25] px-4 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition hover:bg-[#FFB00B]"
            >
              + Tambah Pasien
            </button>
          )}

          <div className="rounded-2xl bg-white px-4 py-2.5 text-xs font-semibold text-brand-navy/70 shadow-sm ring-1 ring-brand-gray-border">
            Device available: {availableDevices.length}
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-2xl border border-[#FBCC25]/40 bg-[#FBCC25]/10 px-4 py-3 text-sm font-medium text-brand-navy">
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-brand-gray-border bg-white p-6 text-sm text-brand-navy/60 shadow-card">
          <Loader2 className="h-4 w-4 animate-spin" /> Membaca data pasien dari
          Firestore...
        </div>
      ) : patients.length === 0 ? (
        <div className="rounded-2xl border border-brand-gray-border bg-white p-6 text-sm text-brand-navy/50 shadow-card">
          Belum ada pasien di collection <b>patients</b>.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-brand-gray-border bg-white shadow-card">
            <div className="border-b border-brand-gray-border p-3.5">
              <h2 className="font-display text-lg font-bold text-brand-navy">
                List Pasien
              </h2>
              <p className="text-xs text-brand-navy/45">
                {filteredPatients.length} pasien tampil
              </p>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {filteredPatients.map((view) => {
                const active = view.patient.patientId === activePatientId;
                const selected =
                  view.patient.patientId === selectedPatient?.patient.patientId;
                return (
                  <div
                    key={view.patient.patientId}
                    className={`flex items-center gap-2 border-b border-brand-gray-border px-3 py-2.5 transition ${selected
                        ? "bg-[#FBCC25]/20"
                        : "bg-white hover:bg-brand-gray-soft"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPatientId(view.patient.patientId)
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? "bg-[#FBCC25]" : "bg-brand-gray-soft"}`}
                      >
                        <UserRound className="h-4 w-4 text-brand-navy" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-bold text-brand-navy">
                            {view.patient.patientName}
                          </p>
                          {active && (
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                          )}
                        </div>
                        <p className="truncate text-xs text-brand-navy/45">
                          {view.patient.createdByNurseName ?? "-"} ·{" "}
                          {view.patient.patientId}
                        </p>
                      </div>
                    </button>

                    {active ? (
                      <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
                        Aktif
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(view.patient.patientId);
                          setSetActivePatient(view);
                        }}
                        disabled={availableDevices.length === 0 || isActivating}
                        className="shrink-0 rounded-xl bg-[#FBCC25] px-2.5 py-1.5 text-xs font-bold text-brand-navy shadow-sm transition hover:bg-[#FFB00B] disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          availableDevices.length === 0
                            ? "Tidak ada device available"
                            : "Set pasien ini aktif ke device"
                        }
                      >
                        Set Aktif
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-brand-gray-border bg-white p-4 shadow-card">
            {selectedPatient ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FBCC25]/25 text-brand-navy">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold text-brand-navy">
                        {selectedPatient.patient.patientName}
                      </h2>
                      <p className="text-xs text-brand-navy/45">
                        ID: {selectedPatient.patient.patientId}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {isSelectedActive ? (
                      <>
                        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                          Aktif
                        </span>

                        {canStartExamination && (
                          <button
                            type="button"
                            onClick={startExamination}
                            disabled={isStartingExam}
                            className="rounded-xl bg-[#FBCC25] px-4 py-2 text-xs font-bold text-brand-navy shadow-sm transition hover:bg-[#FFB00B] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isStartingExam ? "Memulai..." : "Mulai Pemeriksaan"}
                          </button>
                        )}

                        {isDeviceMeasuring && (
                          <>
                            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700">
                              Sedang diperiksa
                            </span>

                            {canCancelExamination && (
                              <button
                                type="button"
                                onClick={cancelExamination}
                                disabled={isCancellingExam}
                                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isCancellingExam ? "Membatalkan..." : "Cancel Pemeriksaan"}
                              </button>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full border border-brand-gray-border bg-brand-gray-soft px-3 py-2 text-xs font-semibold text-brand-navy/50">
                        Tidak aktif
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-brand-navy/70 sm:grid-cols-2">
                  <InfoItem
                    icon={<Baby className="h-4 w-4" />}
                    label="Nurse"
                    value={selectedPatient.patient.createdByNurseName ?? "-"}
                  />
                  <InfoItem
                    icon={<Activity className="h-4 w-4" />}
                    label="Session"
                    value={selectedPatient.latestSession?.sessionId ?? "-"}
                  />
                  <InfoItem
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Posisi"
                    value={
                      selectedPatient.latestSession?.currentPosition ?? "-"
                    }
                  />
                  <InfoItem
                    icon={<MonitorCog className="h-4 w-4" />}
                    label="Device"
                    value={selectedPatient.latestSession?.deviceName ?? "-"}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-brand-gray-border bg-brand-gray-soft/60 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-red-500" />
                      <div>
                        <h3 className="text-sm font-bold text-brand-navy">
                          Hasil Pemeriksaan Terbaru
                        </h3>
                        <p className="text-xs text-brand-navy/45">
                          SBP, DBP, BPM, MAP, dan ROT
                        </p>
                      </div>
                    </div>
                    {assessment && (
                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold ${getAssessmentClasses(assessment.level)}`}
                      >
                        {assessment.label}
                      </span>
                    )}
                  </div>

                  {latest && assessment ? (
                    <div className="space-y-3">
                      <div className="hidden justify-end">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${getAssessmentClasses(assessment.level)}`}
                        >
                          {assessment.label}
                        </span>
                      </div>

                      <div
                        className={`rounded-2xl border p-4 ${getPanelClasses(assessment.level)}`}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider text-brand-navy/45">
                          Tekanan Darah
                        </p>
                        <div className="mt-2 flex items-end gap-2">
                          <span className="font-display text-5xl font-bold leading-none text-brand-navy">
                            {latest.sbp}
                          </span>
                          <span className="pb-1 font-display text-4xl font-bold leading-none text-brand-navy/55">
                            / {latest.dbp}
                          </span>
                          <span className="pb-2 text-xs font-semibold text-brand-navy/45">
                            mmHg
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-brand-navy/50">
                          Sistolik / Diastolik · {assessment.bpLabel}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Metric
                          label="BPM"
                          value={latest.bpm}
                          sublabel={`${assessment.bpmLabel} · denyut/menit`}
                        />
                        <Metric
                          label="MAP"
                          value={latest.map}
                          sublabel={`${assessment.mapLabel} · mmHg`}
                        />
                      </div>

                      <div className="rounded-2xl border border-brand-gray-border bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gray-soft text-brand-navy/60">
                              <Activity className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-brand-navy">
                                Roll Over Test
                              </h4>
                              <p className="text-xs text-brand-navy/45">
                                DBP terlentang - DBP miring kiri
                              </p>
                            </div>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${getAssessmentClasses(assessment.rotLabel === "ROT Positif" ? "danger" : assessment.rotLabel === "ROT Waspada" ? "warning" : "normal")}`}
                          >
                            {assessment.rotLabel}
                          </span>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                          <Metric
                            label="Nilai ROT"
                            value={assessment.rotValue ?? "-"}
                            sublabel="mmHg"
                            highlight
                          />
                          <Metric
                            label="DBP Miring"
                            value={assessment.miringDbp ?? "-"}
                            sublabel="mmHg"
                          />
                          <Metric
                            label="DBP Terlentang"
                            value={assessment.terlentangDbp ?? "-"}
                            sublabel="mmHg"
                          />
                        </div>
                      </div>

                      <div
                        className={`rounded-2xl border p-3 ${getAssessmentClasses(assessment.level)}`}
                      >
                        <div className="flex items-start gap-3">
                          {assessment.level === "normal" ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5" />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-5 w-5" />
                          )}
                          <div>
                            <p className="font-bold">{assessment.title}</p>
                            <p className="mt-0.5 text-xs">
                              {assessment.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white p-4 text-sm text-brand-navy/50">
                      Belum ada measurement untuk pasien ini.
                    </div>
                  )}
                </div>

                {selectedPatient.measurements.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-brand-gray-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-gray-soft text-xs uppercase text-brand-navy/45">
                        <tr>
                          <th className="px-3 py-2">Posisi</th>
                          <th className="px-3 py-2">SBP</th>
                          <th className="px-3 py-2">DBP</th>
                          <th className="px-3 py-2">BPM</th>
                          <th className="px-3 py-2">MAP</th>
                          <th className="px-3 py-2">ROT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-gray-border text-brand-navy">
                        {selectedPatient.measurements.map((measurement) => (
                          <tr key={measurement.measurementId}>
                            <td className="px-3 py-2 font-semibold">
                              {measurement.position}
                            </td>
                            <td className="px-3 py-2">{measurement.sbp}</td>
                            <td className="px-3 py-2">{measurement.dbp}</td>
                            <td className="px-3 py-2">{measurement.bpm}</td>
                            <td className="px-3 py-2">{measurement.map}</td>
                            <td className="px-3 py-2">
                              {measurement.rot ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {measurementHistory.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-brand-gray-border bg-white">
                    <div className="flex items-start justify-between gap-3 border-b border-brand-gray-border bg-white p-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-brand-navy">
                          Riwayat Pengukuran
                        </h3>
                        <p className="text-xs text-brand-navy/45">
                          {measurementHistory.length} data tercatat dari seluruh sesi
                        </p>
                      </div>
                    </div>

                    <div className="max-h-72 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-brand-gray-soft text-xs uppercase text-brand-navy/45">
                          <tr>
                            <th className="px-3 py-2">Waktu</th>
                            <th className="px-3 py-2">Posisi</th>
                            <th className="px-3 py-2">SBP</th>
                            <th className="px-3 py-2">DBP</th>
                            <th className="px-3 py-2">BPM</th>
                            <th className="px-3 py-2">MAP</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-gray-border text-brand-navy">
                          {measurementHistory.map((measurement) => {
                            const status = getMeasurementStatus(measurement);

                            return (
                              <tr key={`${measurement.sessionId}-${measurement.measurementId}`}>
                                <td className="whitespace-nowrap px-3 py-2 text-brand-navy/65">
                                  {formatMeasurementDate(measurement)}
                                </td>
                                <td className="px-3 py-2 font-semibold">
                                  {measurement.position}
                                </td>
                                <td className="px-3 py-2">{measurement.sbp}</td>
                                <td className="px-3 py-2">{measurement.dbp}</td>
                                <td className="px-3 py-2">{measurement.bpm}</td>
                                <td className="px-3 py-2">{measurement.map}</td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                                  >
                                    {status.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {rotHistory.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-brand-gray-border bg-white">
                    <div className="flex items-start justify-between gap-3 border-b border-brand-gray-border bg-white p-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-brand-navy">
                          Riwayat ROT
                        </h3>
                        <p className="text-xs text-brand-navy/45">
                          {rotHistory.length} data ROT tercatat dari seluruh sesi
                        </p>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-brand-gray-soft text-xs uppercase text-brand-navy/45">
                          <tr>
                            <th className="px-3 py-2">Waktu</th>
                            <th className="px-3 py-2">DBP Miring</th>
                            <th className="px-3 py-2">DBP Terlentang</th>
                            <th className="px-3 py-2">ROT</th>
                            <th className="px-3 py-2">Hasil</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-gray-border text-brand-navy">
                          {rotHistory.map((measurement) => {
                            const sessionMeasurements = measurementHistory.filter(
                              (item) => item.sessionId === measurement.sessionId,
                            );
                            const miring = sessionMeasurements.find(
                              (item) => item.position === "miring_kiri",
                            );
                            const rotValue =
                              measurement.rot ??
                              (miring ? measurement.dbp - miring.dbp : null);
                            const status = getRotStatus(rotValue);

                            return (
                              <tr key={`rot-${measurement.sessionId}-${measurement.measurementId}`}>
                                <td className="whitespace-nowrap px-3 py-2 text-brand-navy/65">
                                  {formatMeasurementDate(measurement)}
                                </td>
                                <td className="px-3 py-2">{miring?.dbp ?? "-"}</td>
                                <td className="px-3 py-2">{measurement.dbp}</td>
                                <td className="px-3 py-2 font-bold">
                                  {rotValue !== null ? rotValue : "-"}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                                  >
                                    {status.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-brand-gray-soft p-6 text-sm text-brand-navy/50">
                Pilih pasien di sebelah kiri.
              </div>
            )}
          </section>
        </div>
      )}

      {isAddPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-brand-navy">
                  Tambah Pasien
                </h3>
                <p className="mt-0.5 text-sm text-brand-navy/60">
                  Tambahkan pasien baru ke collection patients sesuai struktur MamaCare V2.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isCreatingPatient) return;
                  setIsAddPatientOpen(false);
                }}
                className="rounded-full p-2 text-brand-navy/50 hover:bg-brand-gray-soft"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">
                  Nama Pasien
                </span>
                <input
                  value={newPatientName}
                  onChange={(event) => setNewPatientName(event.target.value)}
                  placeholder="Contoh: Siti Aminah"
                  className="rounded-2xl border border-brand-gray-border bg-white px-4 py-3 text-sm text-brand-navy outline-none placeholder:text-brand-navy/35 focus:border-[#FBCC25]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/50">
                  Nama Bidan / Nurse
                </span>
                <input
                  value={newNurseName}
                  onChange={(event) => setNewNurseName(event.target.value)}
                  placeholder="Contoh: Bidan Sari"
                  className="rounded-2xl border border-brand-gray-border bg-white px-4 py-3 text-sm text-brand-navy outline-none placeholder:text-brand-navy/35 focus:border-[#FBCC25]"
                />
              </label>

              <div className="rounded-2xl border border-brand-gray-border bg-brand-gray-soft p-4 text-xs text-brand-navy/60">
                patientId akan dibuat otomatis dengan format <b>{"{epoch}_{counter}"}</b>.
                Session belum dibuat sampai pasien di-set aktif dan pemeriksaan dimulai.
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddPatientOpen(false)}
                  disabled={isCreatingPatient}
                  className="rounded-2xl border border-brand-gray-border px-4 py-3 text-sm font-bold text-brand-navy transition hover:bg-brand-gray-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={createPatient}
                  disabled={isCreatingPatient || !newPatientName.trim()}
                  className="rounded-2xl bg-[#FBCC25] px-4 py-3 text-sm font-bold text-brand-navy shadow-sm transition hover:bg-[#FFB00B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingPatient ? "Menyimpan..." : "Simpan Pasien"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {setActivePatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-bold text-brand-navy">
                  Set Aktif
                </h3>
                <p className="mt-0.5 text-sm text-brand-navy/60">
                  Pilih device available untuk pasien{" "}
                  <b>{setActivePatient.patient.patientName}</b>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSetActivePatient(null)}
                className="rounded-full p-2 text-brand-navy/50 hover:bg-brand-gray-soft"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {availableDevices.length === 0 ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  Tidak ada device available. Selesaikan/cancel session aktif
                  dulu atau ubah device ke available.
                </div>
              ) : (
                availableDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    type="button"
                    onClick={() => activatePatientOnDevice(device)}
                    disabled={isActivating}
                    className="flex items-center justify-between rounded-2xl border border-brand-gray-border bg-white p-4 text-left shadow-sm transition hover:border-[#FBCC25] hover:bg-[#FBCC25]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div>
                      <p className="font-display text-xl font-bold text-brand-navy">
                        {device.deviceName}
                      </p>
                      <p className="text-xs text-brand-navy/45">
                        ID: {device.deviceId}
                      </p>
                    </div>
                    {isActivating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-brand-gray-soft px-4 py-3">
      {icon}
      <span className="text-brand-navy/45">{label}:</span>
      <span className="truncate font-semibold text-brand-navy">{value}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${highlight ? "bg-green-50 ring-1 ring-green-100" : "bg-white"}`}
    >
      <p className="text-xs font-semibold uppercase text-brand-navy/45">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-brand-navy">{value}</p>
      {sublabel && (
        <p className="mt-1 text-xs text-brand-navy/45">{sublabel}</p>
      )}
    </div>
  );
}
