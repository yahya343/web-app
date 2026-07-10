/**
 * Static export requires `force-static` on every route.
 * The `apiHandler` wrapper catches errors gracefully when
 * MongoDB is unavailable (e.g., during static export build).
 */
export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ChatMessage } from '@/lib/models/ChatMessage';
import { ChatSession } from '@/lib/models/ChatSession';
import { auth } from '@/lib/auth';
import { apiHandler, parseBody, requireAuth } from '@/lib/api-error';
import { requireRole } from '@/lib/rbac';
import { sanitizeSetPayload } from '@/lib/sanitize';
import { getRateLimitKey, rateLimitCheck } from '@/lib/rate-limit';

const SESSION_PREVIEW_LENGTH = 60;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ─── GET ──────────────────────────────────────────────────────────────
//   /api/chat               → list all sessions (admin)
//   /api/chat?sessionId=xxx → messages for a specific session
export const GET = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Support', 'Technical']);
  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  // ── Messages for a single session ──
  if (sessionId) {
    const messages = await ChatMessage.find({ sessionId })
      .sort({ timestamp: 1 })
      .lean();

    // Mark admin unread as 0 for that session
    await ChatSession.updateOne({ id: sessionId }, { unreadAdmin: 0 });

    return NextResponse.json(messages);
  }

  // ── List all sessions ──
  const sessions = await ChatSession.find({})
    .sort({ lastActivity: -1 })
    .lean();

  return NextResponse.json(sessions);
});

// ─── POST ─────────────────────────────────────────────────────────────
//   Admin sends a message to an existing session
//   Body: { sessionId, text }
export const POST = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Support']);

  // Rate limit: max 60 admin messages per IP per minute
  if (!rateLimitCheck(getRateLimitKey(request), 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  await connectToDatabase();

  const { sessionId, text } = await parseBody<{ sessionId?: string; text?: string }>(request);

  if (!sessionId || !text?.trim()) {
    return NextResponse.json(
      { error: 'sessionId and text are required' },
      { status: 400 },
    );
  }

  // Verify session exists
  const chatSession = await ChatSession.findOne({ id: sessionId });
  if (!chatSession) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 },
    );
  }

  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const msg = new ChatMessage({
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    sender: 'Admin Support',
    senderRole: 'Support',
    text: text.trim(),
    timestamp,
    isAdmin: true,
  });
  await msg.save();

  // Update session last message & bump customer unread
  await ChatSession.updateOne(
    { id: sessionId },
    {
      lastMessage: truncate(text.trim(), SESSION_PREVIEW_LENGTH),
      lastActivity: now.toISOString(),
      $inc: { unreadCustomer: 1 },
    },
  );

  return NextResponse.json(msg.toJSON(), { status: 201 });
});

// ─── PATCH ────────────────────────────────────────────────────────────
//   Update session (resolve)
//   Body: { sessionId, status: 'resolved' }
export const PATCH = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Support']);
  await connectToDatabase();

  const { sessionId, status } = await parseBody<{ sessionId?: string; status?: string }>(request);

  if (!sessionId || !status) {
    return NextResponse.json(
      { error: 'sessionId and status are required' },
      { status: 400 },
    );
  }

  await ChatSession.updateOne({ id: sessionId }, { status });

  return NextResponse.json({ success: true });
});

// ─── DELETE ───────────────────────────────────────────────────────────
//   Delete a message (admin)
//   Body: { id }
export const DELETE = apiHandler(async (request: Request) => {
  const session = await requireAuth(() => auth());
  requireRole(session, ['Super Admin', 'Support']);
  await connectToDatabase();

  const { id } = await parseBody<{ id?: string }>(request);
  if (!id) {
    return NextResponse.json(
      { error: 'Message ID is required' },
      { status: 400 },
    );
  }

  await ChatMessage.deleteOne({ id });
  return NextResponse.json({ success: true });
});
