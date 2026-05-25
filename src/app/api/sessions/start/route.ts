import { NextResponse } from 'next/server';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

function getCounterText(count: number) {
    return String(count + 1).padStart(3, '0');
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const deviceId = String(body.deviceId ?? '');
        const nurseId = String(body.nurseId ?? 'uid123');
        const nurseName = String(body.nurseName ?? 'Bidan Test');

        if (!deviceId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'deviceId wajib diisi.',
                },
                { status: 400 }
            );
        }

        const deviceRef = doc(db, 'devices', deviceId);
        const deviceSnap = await getDoc(deviceRef);

        if (!deviceSnap.exists()) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Device tidak ditemukan.',
                },
                { status: 404 }
            );
        }

        const device = deviceSnap.data();

        if (device.status === 'in_use' || device.sessionStatus === 'active') {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Device masih sedang digunakan.',
                },
                { status: 409 }
            );
        }

        const patientId = String(device.currentPatientId ?? '');
        const patientName = String(device.currentPatientName ?? '');
        const deviceName = String(device.deviceName ?? deviceId);

        if (!patientId || !patientName) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Device belum memiliki pasien aktif. Pilih pasien dulu dari halaman Pasien.',
                },
                { status: 400 }
            );
        }

        const patientRef = doc(db, 'patients', patientId);
        const patientSnap = await getDoc(patientRef);

        if (!patientSnap.exists()) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Patient aktif tidak ditemukan.',
                },
                { status: 404 }
            );
        }

        const sessionsRef = collection(db, 'patients', patientId, 'sessions');
        const existingSessionsSnap = await getDocs(query(sessionsRef, where('deviceId', '==', deviceId)));
        const counter = getCounterText(existingSessionsSnap.size);

        const epoch = Date.now();
        const sessionId = `${epoch}_${deviceName}_${counter}`;

        const sessionData = {
            sessionId,
            patientId,
            patientName,
            nurseId,
            nurseName,
            deviceId,
            deviceName,
            status: 'active',
            currentPosition: 'duduk',
            positionController: 'device',
            positionSequence: ['duduk', 'miring_kiri', 'terlentang'],
            completedPositions: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            completedAt: null,
        };

        const sessionRef = doc(db, 'patients', patientId, 'sessions', sessionId);

        await setDoc(sessionRef, sessionData);

        await updateDoc(patientRef, {
            latestSessionId: sessionId,
        });

        await updateDoc(deviceRef, {
            status: 'in_use',
            sessionStatus: 'active',
            currentSessionId: sessionId,
            currentPatientId: patientId,
            currentPatientName: patientName,
        });

        return NextResponse.json({
            success: true,
            message: 'Session baru berhasil dibuat.',
            patientId,
            patientName,
            deviceId,
            deviceName,
            sessionId,
            currentPosition: 'duduk',
        });
    } catch (error) {
        console.error('POST /api/sessions/start error:', error);

        return NextResponse.json(
            {
                success: false,
                message: 'Internal server error saat membuat session baru.',
            },
            { status: 500 }
        );
    }
}
