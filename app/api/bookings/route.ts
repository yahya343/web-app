/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Booking } from '@/lib/models/Booking';
import { auth } from '@/lib/auth';
import { apiHandler, parseBody, requireAuth, trimStrings } from '@/lib/api-error';
import { sanitizeSetPayload } from '@/lib/sanitize';
import { getRateLimitKey, rateLimitCheck } from '@/lib/rate-limit';
import { requireRole } from '@/lib/rbac';
import type { BookingData } from '@/lib/api-client';

async function getSession() {
  return requireAuth(() => auth());
}

export const GET = apiHandler(async () => {
  await getSession();
  await connectToDatabase();
  const bookings = await Booking.find().sort({ date: -1 }).lean();
  return NextResponse.json(bookings);
});

export const POST = apiHandler(async (request: Request) => {
  const session = await getSession();
  requireRole(session, ['Super Admin', 'Technical', 'Support']);

  // Rate limit: max 30 booking creations per IP per minute
  if (!rateLimitCheck(getRateLimitKey(request), 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  await connectToDatabase();
  const data = trimStrings(await parseBody<Partial<BookingData>>(request));
  if (!data.customerName?.trim() || !data.deviceType?.trim() || !data.issue?.trim()) {
    return NextResponse.json({ error: 'customerName, deviceType, and issue are required' }, { status: 400 });
  }
  const booking = new Booking(data);
  await booking.save();
  return NextResponse.json(booking.toJSON(), { status: 201 });
});

export const PATCH = apiHandler(async (request: Request) => {
  const session = await getSession();
  requireRole(session, ['Super Admin', 'Technical', 'Support']);
  await connectToDatabase();
  const body = await parseBody<{ id: string } & Record<string, unknown>>(request);
  const { id, ...updates } = body;
  if (!id) {
    return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
  }
  // Strip any MongoDB operators from the update payload
  const safeUpdates = sanitizeSetPayload(updates);
  const booking = await Booking.findOneAndUpdate({ id }, { $set: safeUpdates }, { new: true });
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }
  return NextResponse.json(booking.toJSON());
});

export const DELETE = apiHandler(async (request: Request) => {
  const session = await getSession();
  requireRole(session, ['Super Admin', 'Technical']);
  await connectToDatabase();
  const { id } = await parseBody<{ id: string }>(request);
  if (!id) {
    return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
  }
  await Booking.deleteOne({ id });
  return NextResponse.json({ success: true });
});
