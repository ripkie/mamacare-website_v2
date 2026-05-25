import { NextResponse } from "next/server";
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

function normalizeDeviceId(value: unknown) {
    return String(value ?? "")
        .trim()
        .replaceAll(":", "")
        .replaceAll("-", "")
        .toUpperCase();
}

function normalizePairingCode(value: unknown) {
    return String(value ?? "").trim();
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const deviceId = normalizeDeviceId(body.deviceId);
        const pairingCode = normalizePairingCode(body.pairingCode);
        const wifiStatus = String(body.wifiStatus ?? "online");
        const lastSeenEpoch = toNumber(body.lastSeenEpoch) ?? Math.floor(Date.now() / 1000);

        if (!deviceId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "deviceId wajib diisi.",
                },
                { status: 400 },
            );
        }

        if (!pairingCode) {
            return NextResponse.json(
                {
                    success: false,
                    message: "pairingCode wajib diisi.",
                },
                { status: 400 },
            );
        }

        const deviceRef = doc(db, "devices", deviceId);
        const deviceSnap = await getDoc(deviceRef);

        if (deviceSnap.exists()) {
            const device = deviceSnap.data();

            return NextResponse.json({
                success: true,
                registered: true,
                message: "Device sudah terdaftar.",
                device: {
                    deviceId: device.deviceId ?? deviceId,
                    deviceName: device.deviceName ?? null,
                    status: device.status ?? "available",
                    sessionStatus: device.sessionStatus ?? "idle",
                    currentPatientId: device.currentPatientId ?? null,
                    currentPatientName: device.currentPatientName ?? null,
                    currentSessionId: device.currentSessionId ?? null,
                },
            });
        }

        const pairingRef = doc(db, "devicePairingRequests", deviceId);
        const pairingSnap = await getDoc(pairingRef);
        const currentStatus = pairingSnap.exists()
            ? String(pairingSnap.data().status ?? "pending")
            : "pending";

        await setDoc(
            pairingRef,
            {
                deviceId,
                pairingCode,
                status: currentStatus === "approved" ? "approved" : "pending",
                wifiStatus,
                lastSeenEpoch,
                updatedAt: serverTimestamp(),
                ...(pairingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
            },
            { merge: true },
        );

        return NextResponse.json({
            success: true,
            registered: false,
            message:
                currentStatus === "approved"
                    ? "Pairing request sudah approved, menunggu device didaftarkan."
                    : "Pairing request diterima. Menunggu approval admin.",
            pairing: {
                deviceId,
                pairingCode,
                status: currentStatus === "approved" ? "approved" : "pending",
                wifiStatus,
                lastSeenEpoch,
            },
        });
    } catch (error) {
        console.error("POST /api/devices/pairing error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error saat menerima pairing request.",
            },
            { status: 500 },
        );
    }
}
