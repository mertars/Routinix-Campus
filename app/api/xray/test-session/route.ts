import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/test-session — { studentId, subject } — Akademik Röntgen
// tanı testini BAŞLATIR. Öğrenci kendi testini kendi başlatır (gerçek
// üründeki gibi kişisel bir tanı süreci) — bkz. lib/server/xray/adaptive-engine.ts.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const body = await request.json();
    const { studentId, subject } = body as { studentId?: string; subject?: string };
    if (!studentId || !subject?.trim()) {
      return NextResponse.json({ error: "studentId ve subject zorunludur." }, { status: 400 });
    }
    assertOwnsSelf(session, studentId);

    const testSession = await prisma.xrayTestSession.create({ data: { studentId, subject: subject.trim() } });
    return NextResponse.json({ sessionId: testSession.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_test_session_start_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/test-session", handlePost);
