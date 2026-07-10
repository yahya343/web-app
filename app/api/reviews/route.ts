/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Review } from '@/lib/models/Review';
import { auth } from '@/lib/auth';
import { apiHandler, parseBody, requireAuth, trimStrings } from '@/lib/api-error';
import { requireRole } from '@/lib/rbac';
import { sanitizeSetPayload } from '@/lib/sanitize';
import { getRateLimitKey, rateLimitCheck } from '@/lib/rate-limit';

/** GET /api/reviews — Fetch all reviews (admin auth) */
export const GET = apiHandler(async () => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Support', 'Technical']);
  await connectToDatabase();
  const reviews = await Review.find().sort({ date: -1 }).lean();
  return NextResponse.json(reviews);
});

/** POST /api/reviews — Create a review (public, rate-limited) */
export const POST = apiHandler(async (request: Request) => {
  // Rate limit: max 5 review submissions per IP per minute
  if (!rateLimitCheck(getRateLimitKey(request), 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  await connectToDatabase();
  const data = trimStrings(await parseBody<Record<string, unknown>>(request));
  const review = new Review(data);
  await review.save();
  return NextResponse.json(review.toJSON(), { status: 201 });
});

/** PATCH /api/reviews — Update a review (admin, RBAC: Super Admin or Support) */
export const PATCH = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Support']);
  await connectToDatabase();
  const body = await parseBody<{ id?: string } & Record<string, unknown>>(request);
  const { id, ...updates } = body;
  if (!id) {
    return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
  }
  // Strip any MongoDB operators from the update payload
  const safeUpdates = sanitizeSetPayload(updates);
  const review = await Review.findOneAndUpdate({ id }, { $set: safeUpdates }, { new: true });
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }
  return NextResponse.json(review.toJSON());
});

/** DELETE /api/reviews — Delete a review (admin, RBAC: Super Admin or Support) */
export const DELETE = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Support']);
  await connectToDatabase();
  const { id } = await parseBody<{ id?: string }>(request);
  if (!id) {
    return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
  }
  await Review.deleteOne({ id });
  return NextResponse.json({ success: true });
});
