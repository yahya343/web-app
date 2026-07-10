/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Product } from '@/lib/models/Product';
import { auth } from '@/lib/auth';
import { apiHandler, parseBody, requireAuth, trimStrings } from '@/lib/api-error';
import { requireRole } from '@/lib/rbac';
import { sanitizeSetPayload } from '@/lib/sanitize';

/** GET /api/products — Fetch all products */
export const GET = apiHandler(async () => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Technical', 'Support', 'Inventory']);
  await connectToDatabase();
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(products);
});

/** POST /api/products — Create a new product */
export const POST = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Inventory']);
  await connectToDatabase();
  const data = trimStrings(await parseBody<Record<string, unknown>>(request));
  const product = new Product(data);
  await product.save();
  return NextResponse.json(product.toJSON(), { status: 201 });
});

/** PATCH /api/products — Update a product (requires id in body) */
export const PATCH = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Inventory']);
  await connectToDatabase();
  const body = await parseBody<{ id?: string } & Record<string, unknown>>(request);
  const { id, ...updates } = body;
  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }
  // Strip any MongoDB operators from the update payload
  const safeUpdates = sanitizeSetPayload(updates);
  const product = await Product.findOneAndUpdate({ id }, { $set: safeUpdates }, { new: true });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  return NextResponse.json(product.toJSON());
});

/** DELETE /api/products — Delete a product (requires id in body) */
export const DELETE = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Inventory']);
  await connectToDatabase();
  const { id } = await parseBody<{ id?: string }>(request);
  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }
  await Product.deleteOne({ id });
  return NextResponse.json({ success: true });
});
