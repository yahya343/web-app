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
import { apiHandler, parseBody } from '@/lib/api-error';

const SESSION_PREVIEW_LENGTH = 60;

function makeId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ─── GET ──────────────────────────────────────────────────────────────
//   /api/chat/public?sessionId=xxx&customerId=yyy
//   Returns messages for the session (validated by customerId)
export const GET = apiHandler(async (request: Request) => {
  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const customerId = searchParams.get('customerId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 },
    );
  }

  // Validate session exists and belongs to this customer
  const session = await ChatSession.findOne({ id: sessionId });
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 },
    );
  }

  // If customerId provided, verify ownership
  if (customerId && session.customerId !== customerId) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 },
    );
  }

  const messages = await ChatMessage.find({ sessionId })
    .sort({ timestamp: 1 })
    .lean();

  // Mark customer unread as 0
  await ChatSession.updateOne({ id: sessionId }, { unreadCustomer: 0 });

  return NextResponse.json({ messages, session });
});

// ─── POST ─────────────────────────────────────────────────────────────
//   Create a new session or send a message (customer → support)
//   Init:      { customerName, customerId }
//   Message:   { sessionId, customerId, text, sender }
export const POST = apiHandler(async (request: Request) => {
  await connectToDatabase();

  const body = await parseBody<Record<string, unknown>>(request);

  // ── Init: create a new session ──
  if (body.customerName && !body.sessionId) {
    const customerName = (body.customerName as string)?.trim();
    const customerId = body.customerId as string | undefined;

    if (!customerName) {
      return NextResponse.json(
        { error: 'customerName is required' },
        { status: 400 },
      );
    }

    const now = new Date();
    const sessionId = makeId();
    const customerUid = customerId || makeId();

    const session = new ChatSession({
      id: sessionId,
      customerId: customerUid,
      customerName,
      status: 'active',
      lastMessage: 'Session started',
      lastActivity: now.toISOString(),
      createdAt: now.toISOString(),
      unreadAdmin: 0,
      unreadCustomer: 0,
      initiatedBy: 'customer',
    });
    await session.save();

    return NextResponse.json(
      {
        sessionId,
        customerId: customerUid,
        customerName,
      },
      { status: 201 },
    );
  }

  // ── Send a message ──
  if (body.sessionId && body.text != null) {
    const sessionId = body.sessionId as string;
    const customerId = body.customerId as string | undefined;
    const text = (body.text as string)?.trim();
    const sender = body.sender as string | undefined;

    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 },
      );
    }

    // Verify session
    const session = await ChatSession.findOne({ id: sessionId });
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      );
    }

    // Optionally verify customerId
    if (customerId && session.customerId !== customerId) {
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
      sender: sender || session.customerName,
      senderRole: 'User',
      text,
      timestamp,
      isAdmin: false,
    });
    await msg.save();

    // Update session
    await ChatSession.updateOne(
      { id: sessionId },
      {
        status: 'active',
        lastMessage: truncate(text, SESSION_PREVIEW_LENGTH),
        lastActivity: now.toISOString(),
        $inc: { unreadAdmin: 1 },
      },
    );

    return NextResponse.json(msg.toJSON(), { status: 201 });
  }

  return NextResponse.json(
    { error: 'Invalid request body' },
    { status: 400 },
  );
});
