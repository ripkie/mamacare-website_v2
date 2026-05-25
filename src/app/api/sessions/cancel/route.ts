import { NextResponse } from "next/server";
import {
    doc,
    getDoc,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const deviceId = String(body.deviceId ?? "");
        const sessionId = String(body.sessionId ?? "");
        const patientId = String(body.patientId ?? "");

        if (!deviceId || !sessionId || !patientId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "deviceId, sessionId, dan patientId wajib diisi.",
                },
                { status: 400 },
            );
        }

        const deviceRef = doc(db, "devices", deviceId);
        const deviceSnap = await getDoc(deviceRef);

        if (!deviceSnap.exists()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Device tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        const device = deviceSnap.data();

        if (device.currentSessionId !== sessionId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Session tidak cocok dengan device aktif.",
                },
                { status: 403 },
            );
        }

        if (device.currentPatientId !== patientId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Patient tidak cocok dengan device aktif.",
                },
                { status: 403 },
            );
        }

        const sessionRef = doc(db, "patients", patientId, "sessions", sessionId);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Session tidak ditemukan.",
                },
                { status: 404 },
            );
        }

        const session = sessionSnap.data();

        if (session.status !== "active") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Session sudah tidak aktif.",
                },
                { status: 409 },
            );
        }

        await updateDoc(sessionRef, {
            status: "cancelled",
            updatedAt: serverTimestamp(),
            completedAt: serverTimestamp(),
        });

        await updateDoc(deviceRef, {
            status: "available",
            sessionStatus: "idle",
            currentSessionId: null,

            // Pasien tetap nempel ke device sesuai UX hybrid v1.
            currentPatientId: patientId,
            currentPatientName: device.currentPatientName ?? session.patientName ?? null,
        });

        return NextResponse.json({
            success: true,
            message: "Pemeriksaan berhasil dibatalkan.",
            deviceId,
            patientId,
            sessionId,
        });
    } catch (error) {
        console.error("POST /api/sessions/cancel error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error saat membatalkan pemeriksaan.",
            },
            { status: 500 },
        );
    }
}
