"use client";

import AppShell from "@/components/AppShell";
import { auth, db } from "@/lib/firebase/client";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    type DocumentData,
    type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
    CheckCircle2,
    Cpu,
    Loader2,
    LockKeyhole,
    Plus,
    Radio,
    RefreshCw,
    ShieldCheck,
    Trash2,
    Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

type PairingStatus = "pending" | "approved" | "rejected" | string;

type PairingRequest = {
    id: string;
    deviceId: string;
    pairingCode: string;
    status: PairingStatus;
    wifiStatus: string | null;
    lastSeenEpoch: number | null;
    createdAt?: unknown;
    updatedAt?: unknown;
};

type Device = {
    id: string;
    deviceId: string;
    deviceName: string;
    status: string;
    sessionStatus: string;
    currentPatientId: string | null;
    currentPatientName: string | null;
    currentSessionId: string | null;
    wifiStatus: string | null;
    batteryRaw: number | null;
    lastSeenEpoch: number | null;
    registeredBy: string | null;
};

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

function formatTime(value: unknown) {
    const millis = getMillis(value);

    if (!millis) return "-";

    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(millis));
}

function formatEpoch(epoch: number | null) {
    if (!epoch) return "-";

    const millis = epoch < 10_000_000_000 ? epoch * 1000 : epoch;

    return formatTime(millis);
}

function normalizePairingRequest(
    snap: QueryDocumentSnapshot<DocumentData>,
): PairingRequest {
    const data = snap.data();

    return {
        id: snap.id,
        deviceId: String(data.deviceId ?? snap.id),
        pairingCode: String(data.pairingCode ?? "-"),
        status: String(data.status ?? "pending"),
        wifiStatus: data.wifiStatus ? String(data.wifiStatus) : null,
        lastSeenEpoch: numberOrNull(data.lastSeenEpoch),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

function normalizeDevice(snap: QueryDocumentSnapshot<DocumentData>): Device {
    const data = snap.data();

    return {
        id: snap.id,
        deviceId: String(data.deviceId ?? snap.id),
        deviceName: String(data.deviceName ?? snap.id),
        status: String(data.status ?? "available"),
        sessionStatus: String(data.sessionStatus ?? "idle"),
        currentPatientId: data.currentPatientId ? String(data.currentPatientId) : null,
        currentPatientName: data.currentPatientName ? String(data.currentPatientName) : null,
        currentSessionId: data.currentSessionId ? String(data.currentSessionId) : null,
        wifiStatus: data.wifiStatus ? String(data.wifiStatus) : null,
        batteryRaw: numberOrNull(data.batteryRaw),
        lastSeenEpoch: numberOrNull(data.lastSeenEpoch),
        registeredBy: data.registeredBy ? String(data.registeredBy) : null,
    };
}

function statusClass(status: string) {
    if (status === "pending") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (status === "approved") return "bg-green-50 text-green-700 border-green-200";
    if (status === "rejected") return "bg-red-50 text-red-700 border-red-200";
    if (status === "available") return "bg-green-50 text-green-700 border-green-200";
    if (status === "in_use") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (status === "offline") return "bg-red-50 text-red-700 border-red-200";

    return "bg-brand-gray-soft text-brand-navy/60 border-brand-gray-border";
}

export default function AdminDevicesPage() {
    const router = useRouter();

    const [isCheckingRole, setIsCheckingRole] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
    const [manualDeviceId, setManualDeviceId] = useState("");
    const [manualDeviceName, setManualDeviceName] = useState("");
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.replace("/login");
                return;
            }

            try {
                const userSnap = await getDoc(doc(db, "users", user.uid));
                const role = userSnap.exists() ? userSnap.data().role : null;

                if (role !== "admin") {
                    setIsAdmin(false);
                    setIsCheckingRole(false);
                    return;
                }

                setIsAdmin(true);
                setIsCheckingRole(false);
            } catch (error) {
                console.error("Failed to check admin role:", error);
                setIsAdmin(false);
                setIsCheckingRole(false);
            }
        });

        return unsubscribe;
    }, [router]);

    useEffect(() => {
        if (!isAdmin) return;

        const unsubPairing = onSnapshot(
            query(collection(db, "devicePairingRequests"), orderBy("createdAt", "desc")),
            (snap) => {
                setPairingRequests(snap.docs.map(normalizePairingRequest));
                setLoading(false);
            },
            (error) => {
                console.error("Failed to listen pairing requests:", error);
                setLoading(false);
            },
        );

        const unsubDevices = onSnapshot(
            query(collection(db, "devices"), orderBy("deviceName")),
            (snap) => {
                setDevices(snap.docs.map(normalizeDevice));
            },
            (error) => {
                console.error("Failed to listen devices:", error);
            },
        );

        return () => {
            unsubPairing();
            unsubDevices();
        };
    }, [isAdmin]);

    const pendingRequests = useMemo(
        () => pairingRequests.filter((request) => request.status === "pending"),
        [pairingRequests],
    );

    const registeredDeviceIds = useMemo(
        () => new Set(devices.map((device) => device.deviceId)),
        [devices],
    );

    async function approvePairing(request: PairingRequest) {
        const deviceName = deviceNames[request.deviceId]?.trim();

        if (!deviceName) {
            setMessage("Nama device wajib diisi sebelum approve.");
            return;
        }

        setSavingId(request.deviceId);
        setMessage(null);

        try {
            await setDoc(doc(db, "devices", request.deviceId), {
                deviceId: request.deviceId,
                deviceName,

                status: "available",
                currentSessionId: null,
                currentPatientId: null,
                currentPatientName: null,
                sessionStatus: "idle",

                batteryRaw: null,
                wifiStatus: request.wifiStatus ?? "unknown",
                lastSeenEpoch: request.lastSeenEpoch ?? null,

                registeredBy: "admin",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            await updateDoc(doc(db, "devicePairingRequests", request.deviceId), {
                status: "approved",
                deviceName,
                approvedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setDeviceNames((current) => ({
                ...current,
                [request.deviceId]: "",
            }));

            setMessage(`Device ${deviceName} berhasil didaftarkan.`);
        } catch (error) {
            console.error(error);
            setMessage("Gagal approve device. Cek Firestore Rules dan console.");
        } finally {
            setSavingId(null);
        }
    }

    async function rejectPairing(request: PairingRequest) {
        const confirmed = window.confirm(
            `Tolak pairing request ${request.deviceId}?`,
        );

        if (!confirmed) return;

        setSavingId(request.deviceId);
        setMessage(null);

        try {
            await updateDoc(doc(db, "devicePairingRequests", request.deviceId), {
                status: "rejected",
                rejectedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setMessage("Pairing request ditolak.");
        } catch (error) {
            console.error(error);
            setMessage("Gagal menolak pairing request.");
        } finally {
            setSavingId(null);
        }
    }

    async function registerManualDevice() {
        const deviceId = manualDeviceId.trim().replaceAll(":", "").toUpperCase();
        const deviceName = manualDeviceName.trim();

        if (!deviceId || !deviceName) {
            setMessage("Device ID dan nama device wajib diisi.");
            return;
        }

        setSavingId("manual");
        setMessage(null);

        try {
            await setDoc(doc(db, "devices", deviceId), {
                deviceId,
                deviceName,

                status: "available",
                currentSessionId: null,
                currentPatientId: null,
                currentPatientName: null,
                sessionStatus: "idle",

                batteryRaw: null,
                wifiStatus: "unknown",
                lastSeenEpoch: null,

                registeredBy: "admin",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setManualDeviceId("");
            setManualDeviceName("");
            setMessage(`Device ${deviceName} berhasil didaftarkan manual.`);
        } catch (error) {
            console.error(error);
            setMessage("Gagal mendaftarkan device manual.");
        } finally {
            setSavingId(null);
        }
    }

    async function deletePairingRequest(request: PairingRequest) {
        const confirmed = window.confirm(
            `Hapus pairing request ${request.deviceId}?`,
        );

        if (!confirmed) return;

        setSavingId(request.deviceId);
        setMessage(null);

        try {
            await deleteDoc(doc(db, "devicePairingRequests", request.deviceId));
            setMessage("Pairing request berhasil dihapus.");
        } catch (error) {
            console.error(error);
            setMessage("Gagal menghapus pairing request.");
        } finally {
            setSavingId(null);
        }
    }

    async function deleteDevice(device: Device) {
        if (device.sessionStatus === "active") {
            setMessage("Device sedang dipakai dalam sesi aktif dan tidak bisa dihapus.");
            return;
        }

        const confirmed = window.confirm(
            `Hapus device ${device.deviceName} (${device.deviceId})?`,
        );

        if (!confirmed) return;

        setDeletingDeviceId(device.deviceId);
        setMessage(null);

        try {
            await deleteDoc(doc(db, "devices", device.deviceId));
            setMessage(`Device ${device.deviceName} berhasil dihapus.`);
        } catch (error) {
            console.error(error);
            setMessage("Gagal menghapus device. Cek Firestore Rules dan console.");
        } finally {
            setDeletingDeviceId(null);
        }
    }

    if (isCheckingRole) {
        return (
            <AppShell>
                <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-brand-gray-border bg-white shadow-card">
                    <div className="text-center">
                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#FFB00B]" />
                        <p className="mt-3 text-sm font-semibold text-brand-navy/60">
                            Mengecek akses admin...
                        </p>
                    </div>
                </div>
            </AppShell>
        );
    }

    if (!isAdmin) {
        return (
            <AppShell>
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-red-100 bg-white p-6 text-center shadow-card">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                        <LockKeyhole className="h-7 w-7" />
                    </div>
                    <h1 className="font-display text-2xl font-bold text-brand-navy">
                        Akses Admin Ditolak
                    </h1>
                    <p className="mt-2 max-w-md text-sm text-brand-navy/55">
                        Halaman ini hanya bisa dibuka oleh akun dengan role admin.
                        Ubah field <b>role</b> menjadi <b>admin</b> pada document users/uid di Firestore.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.replace("/dashboard")}
                        className="mt-5 rounded-2xl bg-[#FBCC25] px-4 py-2 text-sm font-bold text-brand-navy transition hover:bg-[#FFB00B]"
                    >
                        Kembali ke Dashboard
                    </button>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="font-display text-3xl font-bold text-brand-navy lg:text-4xl">
                        Admin Devices
                    </h1>
                    <p className="mt-1 text-sm text-brand-navy/60">
                        Daftarkan alat MamaCare dari pairing request ESP32 atau input manual.
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-brand-gray-border bg-white px-4 py-2 text-xs font-semibold text-brand-navy/65 shadow-card">
                    <ShieldCheck size={14} />
                    Admin Panel
                </div>
            </div>

            {message && (
                <div className="mb-4 rounded-2xl border border-[#FBCC25]/40 bg-[#FBCC25]/10 px-4 py-3 text-sm font-medium text-brand-navy">
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-3xl border border-brand-gray-border bg-white p-4 shadow-card">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="font-display text-xl font-bold text-brand-navy">
                                Pairing Request
                            </h2>
                            <p className="text-xs text-brand-navy/50">
                                Device yang masuk mode pairing akan muncul di sini.
                            </p>
                        </div>
                        <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-bold text-yellow-700">
                            {pendingRequests.length} pending
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex min-h-[260px] items-center justify-center">
                            <Loader2 className="animate-spin text-[#FFB00B]" />
                        </div>
                    ) : pendingRequests.length === 0 ? (
                        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-brand-gray-border bg-brand-gray-soft/40 text-center">
                            <Radio className="mb-3 h-9 w-9 text-brand-navy/25" />
                            <h3 className="font-display text-xl font-bold text-brand-navy">
                                Belum ada request pairing
                            </h3>
                            <p className="mt-1 max-w-md text-sm text-brand-navy/50">
                                Nanti ESP32 mode pairing akan mengirim deviceId dan pairingCode ke collection devicePairingRequests.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {pendingRequests.map((request) => {
                                const alreadyRegistered = registeredDeviceIds.has(request.deviceId);

                                return (
                                    <div
                                        key={request.deviceId}
                                        className="rounded-2xl border border-brand-gray-border bg-brand-gray-soft/60 p-4"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="font-display text-lg font-bold text-brand-navy">
                                                        {request.deviceId}
                                                    </h3>
                                                    <span
                                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
                                                            request.status,
                                                        )}`}
                                                    >
                                                        {request.status}
                                                    </span>
                                                    {alreadyRegistered && (
                                                        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
                                                            sudah terdaftar
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-xs text-brand-navy/50">
                                                    Pairing code: <b>{request.pairingCode}</b>
                                                </p>
                                                <p className="mt-1 text-xs text-brand-navy/50">
                                                    Last seen: {formatEpoch(request.lastSeenEpoch)} · WiFi: {request.wifiStatus ?? "-"}
                                                </p>
                                            </div>

                                            <div className="grid gap-2 sm:min-w-[260px]">
                                                <input
                                                    value={deviceNames[request.deviceId] ?? ""}
                                                    onChange={(event) =>
                                                        setDeviceNames((current) => ({
                                                            ...current,
                                                            [request.deviceId]: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Nama device, contoh MCW01"
                                                    className="rounded-xl border border-brand-gray-border bg-white px-3 py-2 text-sm text-brand-navy outline-none placeholder:text-brand-navy/35 focus:border-[#FBCC25]"
                                                    disabled={alreadyRegistered || savingId === request.deviceId}
                                                />

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => approvePairing(request)}
                                                        disabled={
                                                            alreadyRegistered ||
                                                            savingId === request.deviceId ||
                                                            !deviceNames[request.deviceId]?.trim()
                                                        }
                                                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#FBCC25] px-3 py-2 text-xs font-bold text-brand-navy transition hover:bg-[#FFB00B] disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {savingId === request.deviceId ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                        )}
                                                        Approve
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => rejectPairing(request)}
                                                        disabled={savingId === request.deviceId || alreadyRegistered}
                                                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Tolak
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => deletePairingRequest(request)}
                                                        disabled={savingId === request.deviceId}
                                                        className="rounded-xl border border-brand-gray-border bg-white px-3 py-2 text-xs font-bold text-brand-navy/55 transition hover:bg-brand-gray-soft disabled:cursor-not-allowed disabled:opacity-50"
                                                        title="Hapus request"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="rounded-3xl border border-brand-gray-border bg-white p-4 shadow-card">
                    <div className="mb-4">
                        <h2 className="font-display text-xl font-bold text-brand-navy">
                            Daftar Manual
                        </h2>
                        <p className="text-xs text-brand-navy/50">
                            Dipakai kalau pairing alat belum tersedia.
                        </p>
                    </div>

                    <div className="grid gap-3">
                        <label className="grid gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">
                                Device ID / MAC ESP32
                            </span>
                            <input
                                value={manualDeviceId}
                                onChange={(event) => setManualDeviceId(event.target.value)}
                                placeholder="A4CF12B89E10"
                                className="rounded-xl border border-brand-gray-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none placeholder:text-brand-navy/35 focus:border-[#FBCC25]"
                            />
                        </label>

                        <label className="grid gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide text-brand-navy/45">
                                Nama Device
                            </span>
                            <input
                                value={manualDeviceName}
                                onChange={(event) => setManualDeviceName(event.target.value)}
                                placeholder="MCW01"
                                className="rounded-xl border border-brand-gray-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none placeholder:text-brand-navy/35 focus:border-[#FBCC25]"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={registerManualDevice}
                            disabled={
                                savingId === "manual" ||
                                !manualDeviceId.trim() ||
                                !manualDeviceName.trim()
                            }
                            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FBCC25] px-4 py-3 text-sm font-bold text-brand-navy transition hover:bg-[#FFB00B] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {savingId === "manual" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Daftarkan Device
                        </button>

                        <div className="rounded-2xl border border-brand-gray-border bg-brand-gray-soft p-3 text-xs text-brand-navy/55">
                            Device ID akan dijadikan document ID pada collection <b>devices</b>.
                            Tanda <b>:</b> pada MAC otomatis dihapus.
                        </div>
                    </div>
                </section>
            </div>

            <section className="mt-4 rounded-3xl border border-brand-gray-border bg-white p-4 shadow-card">
                <div className="mb-4 flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-brand-yellow2" />
                    <div>
                        <h2 className="font-display text-xl font-bold text-brand-navy">
                            Device Terdaftar
                        </h2>
                        <p className="text-xs text-brand-navy/50">
                            Device resmi yang sudah masuk collection devices.
                        </p>
                    </div>
                </div>

                {devices.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-brand-gray-border p-5 text-center text-sm text-brand-navy/50">
                        Belum ada device terdaftar.
                    </div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {devices.map((device) => (
                            <div
                                key={device.deviceId}
                                className="rounded-2xl border border-brand-gray-border bg-brand-gray-soft/60 p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-display text-lg font-bold text-brand-navy">
                                            {device.deviceName}
                                        </h3>
                                        <p className="text-xs text-brand-navy/45">{device.deviceId}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span
                                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
                                                device.status,
                                            )}`}
                                        >
                                            {device.status}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => deleteDevice(device)}
                                            disabled={
                                                deletingDeviceId === device.deviceId ||
                                                device.sessionStatus === "active"
                                            }
                                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                            title={
                                                device.sessionStatus === "active"
                                                    ? "Device sedang dalam sesi aktif"
                                                    : "Hapus device"
                                            }
                                        >
                                            {deletingDeviceId === device.deviceId ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3.5 w-3.5" />
                                            )}
                                            {deletingDeviceId === device.deviceId
                                                ? "Menghapus"
                                                : "Hapus"}
                                        </button>
                                    </div>
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
                                        <Wifi size={14} className="text-brand-navy/35" />
                                        <span className="font-semibold text-brand-navy">
                                            {device.wifiStatus ?? "-"}
                                        </span>
                                    </div>

                                    <div className="rounded-xl bg-white p-2">
                                        <p className="text-brand-navy/40">Battery</p>
                                        <p className="font-semibold text-brand-navy">
                                            {device.batteryRaw ?? "-"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </AppShell>
    );
}
