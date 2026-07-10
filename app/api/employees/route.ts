/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import { Employee } from '@/lib/models/Employee';
import { auth } from '@/lib/auth';
import { apiHandler, parseBody, requireAuth, trimStrings } from '@/lib/api-error';
import { requireRole } from '@/lib/rbac';
import { sanitizeSetPayload } from '@/lib/sanitize';
import { getRateLimitKey, rateLimitCheck } from '@/lib/rate-limit';

/** GET /api/employees — Fetch all employees (wider read access for dashboard stats) */
export const GET = apiHandler(async () => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Technical', 'Support', 'Inventory']);
  await connectToDatabase();
  const employees = await Employee.find().sort({ createdAt: -1 }).lean();
  // Strip passwordHash from lean results (toJSON transform doesn't apply to lean)
  const sanitized = employees.map(({ passwordHash, ...rest }) => rest);
  return NextResponse.json(sanitized);
});

/** POST /api/employees — Create a new employee (Super Admin only) */
export const POST = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin']);

  // Rate limit: max 10 employee creation attempts per IP per hour
  if (!rateLimitCheck(getRateLimitKey(request), 10, 3600_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  await connectToDatabase();
  const body = trimStrings(await parseBody<Record<string, unknown>>(request));
  const { password, ...employeeData } = body as { password?: string } & Record<string, unknown>;

  if (!password || (password as string).length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  // Check for duplicate username
  const existing = await Employee.findOne({ username: employeeData.username });
  if (existing) {
    return NextResponse.json(
      { error: 'An employee with this username already exists' },
      { status: 409 }
    );
  }

  // Hash the password
  const passwordHash = await bcrypt.hash(password as string, 12);

  const employee = new Employee({
    ...employeeData,
    passwordHash,
  });
  await employee.save();

  return NextResponse.json(employee.toJSON(), { status: 201 });
});

/** PATCH /api/employees — Update employee fields (Super Admin only) */
export const PATCH = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin']);
  await connectToDatabase();
  const body = await parseBody<Record<string, unknown>>(request);
  const { id, password, ...updates } = body as { id?: string; password?: string } & Record<string, unknown>;

  if (!id) {
    return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
  }

  // Sanitize update payload to prevent NoSQL injection
  const safeUpdates = sanitizeSetPayload(updates as Record<string, unknown>);
  const updateFields: Record<string, unknown> = { $set: safeUpdates };

  // If a new password is provided, hash it
  if (password) {
    if ((password as string).length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }
    (updateFields.$set as Record<string, unknown>).passwordHash = await bcrypt.hash(password as string, 12);
  }

  const employee = await Employee.findOneAndUpdate({ id }, updateFields, { new: true });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  return NextResponse.json(employee.toJSON());
});

/** DELETE /api/employees — Delete an employee (Super Admin only) */
export const DELETE = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin']);
  await connectToDatabase();
  const { id } = await parseBody<{ id?: string }>(request);
  if (!id) {
    return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
  }

  const employee = await Employee.findOne({ id });
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  if (employee.role === 'Super Admin') {
    return NextResponse.json({ error: 'Cannot delete Super Admin' }, { status: 403 });
  }

  await Employee.deleteOne({ id });
  return NextResponse.json({ success: true });
});
