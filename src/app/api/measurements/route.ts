import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();

  // TODO:
  // 1. validate deviceId + sessionId
  // 2. save measurement to Firestore
  // 3. update session progress
  // 4. update device status if completed

  console.log('Measurement payload:', body);

  return NextResponse.json({
    success: true,
    message: 'Measurement received',
  });
}
