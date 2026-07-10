/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { SystemSettings } from '@/lib/models/SystemSettings';
import { apiHandler } from '@/lib/api-error';

/** Default location values — safe fallback for the public map */
function getDefaultLocation() {
  return {
    locationAddress: 'Omagh Phone & Vape, 21 High Street, Omagh BT78 1BA',
    locationCoordinates: '54.6003° N, 7.2996° W',
    mapEmbedUrl:
      'https://www.openstreetmap.org/export/embed.html?bbox=-7.3096%2C54.5903%2C-7.2896%2C54.6103&layer=mapnik&marker=54.6003%2C-7.2996',
  };
}

/**
 * GET /api/public/location
 *
 * Public endpoint — no authentication required.
 * Returns only the location-related settings for displaying the map on the landing page.
 */
export const GET = apiHandler(async () => {
  await connectToDatabase();
  const settings = await SystemSettings.findOne().lean();

  if (!settings) {
    return NextResponse.json(getDefaultLocation());
  }

  return NextResponse.json({
    locationAddress: settings.locationAddress || getDefaultLocation().locationAddress,
    locationCoordinates: settings.locationCoordinates || getDefaultLocation().locationCoordinates,
    mapEmbedUrl: settings.mapEmbedUrl || getDefaultLocation().mapEmbedUrl,
  });
});
