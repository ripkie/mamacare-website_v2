import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const deviceId = searchParams.get("deviceId");

        if (!deviceId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "deviceId wajib diisi.",
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

        return NextResponse.json({
            success: true,

            device: {
                deviceId: device.deviceId ?? deviceId,
                deviceName: device.deviceName ?? null,

                status: device.status ?? "available",
                sessionStatus: device.sessionStatus ?? "idle",

                currentPatientId:
                    device.currentPatientId ?? null,

                currentPatientName:
                    device.currentPatientName ?? null,

                currentSessionId:
                    device.currentSessionId ?? null,

                batteryRaw:
                    device.batteryRaw ?? null,

                wifiStatus:
                    device.wifiStatus ?? null,

                lastSeenEpoch:
                    device.lastSeenEpoch ?? null,
            },
        });
    } catch (error) {
        console.error(
            "GET /api/devices error:",
            error,
        );

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error.",
            },
            { status: 500 },
        );
    }
}