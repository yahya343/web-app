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
import { Product } from '@/lib/models/Product';
import { SystemSettings } from '@/lib/models/SystemSettings';
import { EmployeeRole } from '@/lib/models/Employee';
import { requireAuth, apiHandler, parseBody } from '@/lib/api-error';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getRateLimitKey, rateLimitCheck } from '@/lib/rate-limit';

/**
 * POST /api/seed — Seed the database with default data.
 * Creates default super admin accounts and sample products.
 * Safe to call multiple times — skips if employees already exist.
 * Only Super Admins can trigger seeding.
 */
export const POST = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin']);

  // Rate limit: max 3 seed attempts per IP per hour
  if (!rateLimitCheck(getRateLimitKey(request), 3, 3600_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  await connectToDatabase();

  // Check if already seeded
  const existingCount = await Employee.countDocuments();
  if (existingCount > 0) {
    return NextResponse.json({ message: 'Database already seeded' });
  }

  // Create super admin employees with hashed passwords
  const passwordHash1 = await bcrypt.hash('admin', 12);
  const passwordHash2 = await bcrypt.hash('admin', 12);

  await Employee.create([
    {
      id: 'emp_admin',
      name: 'Super Admin',
      username: 'admin',
      passwordHash: passwordHash1,
      role: EmployeeRole.SUPER_ADMIN,
      status: 'online',
      blocked: false,
      permissions: { read: true, edit: true, repairsOnly: false, chatOnly: false, inventoryOnly: false },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'emp_rtx',
      name: 'Super Admin',
      username: 'rtx',
      passwordHash: passwordHash2,
      role: EmployeeRole.SUPER_ADMIN,
      status: 'online',
      blocked: false,
      permissions: { read: true, edit: true, repairsOnly: false, chatOnly: false, inventoryOnly: false },
      createdAt: new Date().toISOString(),
    },
  ]);

  // Create sample products
  await Product.create([
    { id: 'PRD-001', name: 'iPhone 15 Pro Case', category: 'Accessories', price: 24.99, stock: 145, status: 'available', imageUrl: '', description: 'Premium protective case for iPhone 15 Pro', externalLink: '', createdAt: new Date().toISOString() },
    { id: 'PRD-002', name: '65W Fast Charger', category: 'Chargers', price: 34.99, stock: 89, status: 'available', imageUrl: '', description: 'Ultra-fast USB-C charging adapter', externalLink: '', createdAt: new Date().toISOString() },
    { id: 'PRD-003', name: 'Bluetooth Earbuds', category: 'Audio', price: 49.99, stock: 62, status: 'available', imageUrl: '', description: 'Wireless earbuds with noise cancellation', externalLink: '', createdAt: new Date().toISOString() },
    { id: 'PRD-004', name: 'Samsung Galaxy S24 Case', category: 'Accessories', price: 18.99, stock: 8, status: 'low', imageUrl: '', description: 'Slim protective case for Samsung Galaxy S24', externalLink: '', createdAt: new Date().toISOString() },
  ]);

  // Create default settings
  await SystemSettings.create({
    _id: 'system_config',
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
  });

  return NextResponse.json({ message: 'Database seeded successfully' });
});
