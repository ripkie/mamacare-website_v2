import { NextResponse } from 'next/server';
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

type Position = 'duduk' | 'miring_kiri' | 'terlentang';

const POSITION_ORDER: Position[] = ['duduk', 'miring_kiri', 'terlentang'];

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getMeasurementId(position: Position) {
  if (position === 'duduk') return 'meas_01_duduk';
  if (position === 'miring_kiri') return 'meas_02_miring_kiri';
  return 'meas_03_terlentang';
}

function getNextPosition(position: Position): Position | null {
  const index = POSITION_ORDER.indexOf(position);
  if (index < 0) return null;
  return POSITION_ORDER[index + 1] ?? null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const patientId = String(body.patientId ?? '');
    const sessionId = String(body.sessionId ?? '');
    const deviceId = String(body.deviceId ?? '');
    const position = String(body.position ?? '') as Position;

    const sbp = toNumber(body.sbp);
    const dbp = toNumber(body.dbp);
    const bpm = toNumber(body.bpm);
    const map = toNumber(body.map);
    const rot = toNumber(body.rot);
    const batteryRaw = toNumber(body.batteryRaw);
    const epochTime = toNumber(body.epochTime);

    if (!patientId || !sessionId || !deviceId || !position) {
      return NextResponse.json(
        {
          success: false,
          message: 'patientId, sessionId, deviceId, dan position wajib diisi.',
        },
        { status: 400 }
      );
    }

    if (!POSITION_ORDER.includes(position)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Position tidak valid. Gunakan duduk, miring_kiri, atau terlentang.',
        },
        { status: 400 }
      );
    }

    if (
      sbp === null ||
      dbp === null ||
      bpm === null ||
      map === null ||
      batteryRaw === null ||
      epochTime === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Field sbp, dbp, bpm, map, batteryRaw, dan epochTime wajib berupa number.',
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

    if (device.currentSessionId !== sessionId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Session tidak cocok dengan device aktif.',
        },
        { status: 403 }
      );
    }

    if (device.currentPatientId !== patientId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Patient tidak cocok dengan device aktif.',
        },
        { status: 403 }
      );
    }

    if (device.status !== 'in_use' || device.sessionStatus !== 'active') {
      return NextResponse.json(
        {
          success: false,
          message: 'Device tidak sedang dalam session aktif.',
        },
        { status: 403 }
      );
    }

    const sessionRef = doc(db, 'patients', patientId, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Session tidak ditemukan.',
        },
        { status: 404 }
      );
    }

    const session = sessionSnap.data();

    if (session.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          message: 'Session tidak aktif.',
        },
        { status: 403 }
      );
    }

    const measurementId = getMeasurementId(position);
    const measurementRef = doc(
      db,
      'patients',
      patientId,
      'sessions',
      sessionId,
      'measurements',
      measurementId
    );

    const measurementData = {
      measurementId,
      patientId,
      sessionId,
      deviceId,
      position,
      bpm,
      dbp,
      sbp,
      map,
      rot: position === 'terlentang' ? rot : null,
      batteryRaw,
      epochTime,
      uploadedAt: serverTimestamp(),
    };

    await setDoc(measurementRef, measurementData);

    const nextPosition = getNextPosition(position);
    const isCompleted = position === 'terlentang';

    await updateDoc(sessionRef, {
      currentPosition: isCompleted ? 'terlentang' : nextPosition,
      completedPositions: arrayUnion(position),
      status: isCompleted ? 'completed' : 'active',
      updatedAt: serverTimestamp(),
      completedAt: isCompleted ? serverTimestamp() : null,
    });

    const patientRef = doc(db, 'patients', patientId);

    await updateDoc(patientRef, {
      latestSessionId: sessionId,
      latestMeasurement: measurementData,
      ...(position === 'terlentang'
        ? {
          latestROT: {
            rot,
            dbpTerlentang: dbp,
            updatedAt: serverTimestamp(),
          },
        }
        : {}),
    });

    await updateDoc(deviceRef, {
      batteryRaw,
      lastSeenEpoch: epochTime,
      wifiStatus: 'online',

      // Device status tetap mengikuti kondisi alat.
      // Saat posisi terakhir selesai, alat sudah tidak sedang mengukur lagi.
      status: isCompleted ? 'available' : 'in_use',
      sessionStatus: isCompleted ? 'idle' : 'active',

      // Session aktif dikosongkan setelah 3 posisi selesai.
      currentSessionId: isCompleted ? null : sessionId,

      // PENTING untuk UX v1/hybrid:
      // currentPatientId dan currentPatientName TIDAK dikosongkan saat session selesai.
      // Ini membuat pasien tetap aktif/terpilih di web sampai nurse memilih pasien lain.
      currentPatientId: patientId,
      currentPatientName: device.currentPatientName ?? session.patientName ?? null,
    });

    return NextResponse.json({
      success: true,
      message: isCompleted ? 'Measurement saved. Session completed.' : 'Measurement saved.',
      measurementId,
      nextPosition,
      completed: isCompleted,
      activePatientKept: true,
    });
  } catch (error) {
    console.error('POST /api/measurements error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error saat menyimpan measurement.',
      },
      { status: 500 }
    );
  }
}
