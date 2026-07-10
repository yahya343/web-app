/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SystemSettings } from '@/lib/models/SystemSettings';
import { auth } from '@/lib/auth';
import { apiHandler, parseBody, requireAuth } from '@/lib/api-error';
import { requireRole } from '@/lib/rbac';
import { sanitizeSetPayload } from '@/lib/sanitize';
import { getRateLimitKey, rateLimitCheck } from '@/lib/rate-limit';

/** Default configuration object — acts as a safe fallback */
function getDefaultSettings() {
  return {
    profileName: 'Admin',
    profileTitle: 'System Admin',
    profileEmail: 'admin@omagh.com',
    profilePhone: '+442890123456',
    profileAvatarUrl: '',
    language: 'en',
    timezone: 'europe/london',
    theme: 'dark',
    emailNotifications: true,
    browserAlerts: true,
    smsAlerts: false,
    platformLogoUrl: '',
    primaryColor: '#00f0ff',
    autoBarcode: true,
    barcodeFormat: 'code128',
    printSize: 50,
    locationAddress: 'Omagh Phone & Vape, 21 High Street, Omagh BT78 1BA',
    locationCoordinates: '54.6003° N, 7.2996° W',
    mapEmbedUrl:
      'https://www.openstreetmap.org/export/embed.html?bbox=-7.3096%2C54.5903%2C-7.2896%2C54.6103&layer=mapnik&marker=54.6003%2C-7.2996',
  };
}

/** Ensure a default settings document exists — returns a plain object */
async function ensureSettings(): Promise<Record<string, unknown>> {
  try {
    const existing = await SystemSettings.findOne().lean();
    if (existing) return existing;

    // No document found — create one in the database
    const created = await SystemSettings.create(getDefaultSettings());
    return created.toJSON();
  } catch {
    // If anything goes wrong (CastError, connection hiccup, etc.),
    // return safe defaults so the frontend never sees a 500.
    return getDefaultSettings();
  }
}

export const GET = apiHandler(async () => {
  const session = await requireAuth(() => auth());
  // All authenticated employees can read settings (needed for dashboard)
  requireRole(session, ['Super Admin', 'Technical', 'Support', 'Inventory']);
  await connectToDatabase();
  const settings = await ensureSettings();
  return NextResponse.json(settings);
});

export const PATCH = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin']);

  // Rate limit: max 30 settings updates per IP per hour
  if (!rateLimitCheck(getRateLimitKey(request), 30, 3600_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  await connectToDatabase();
  const updates = await parseBody<Record<string, unknown>>(request);
  // Strip any MongoDB operators from the update payload
  const safeUpdates = sanitizeSetPayload(updates);
  const settings = await SystemSettings.findOneAndUpdate(
    {},
    { $set: safeUpdates },
    { new: true, upsert: true }
  );
  return NextResponse.json(settings.toJSON());
});
