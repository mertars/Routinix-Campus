import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// PATCH /api/guidance-program/entries/[id] — { done: boolean }
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15: "tuşlar direkt hiçbir tepki vermiyor"):
// sistemdeki blokların ezici çoğunluğu QUESTION ve soru bloğu tıklanabilir
// DEĞİLDİ — "40 soru" yazan bir etiketti. Video ve röntgen bloklarının doğal
// bir tamamlanma sinyali var (izlendi / çözüldü); soru ve konu çalışmanın
// yok, o yüzden öğrenci kendisi işaretler.
//
// ⚠️ Yetki: SADECE öğrencinin KENDİ programındaki blok. Bir öğrenci
// başkasının bloğunu işaretleyemez — blok, programı üzerinden öğrenciye
// çözülür ve assertOwnsSelf uygulanır.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const body = (await request.json().catch(() => null)) as { done?: unknown } | null;
    if (typeof body?.done !== "boolean") {
      return NextResponse.json({ error: "done true veya false olmalı." }, { status: 400 });
    }

    const entry = await prisma.guidanceProgramEntry.findUnique({
      where: { id: params.id },
      select: { id: true, program: { select: { studentId: true, student: { select: { institutionId: true } } } } },
    });
    if (!entry) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    requireInstitution(session, entry.program.student.institutionId);
    assertOwnsSelf(session, entry.program.studentId);

    await prisma.guidanceProgramEntry.update({
      where: { id: params.id },
      data: { completedAt: body.done ? new Date() : null },
    });

    return NextResponse.json({ ok: true, done: body.done });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_program_entry_update_failed", error);
  }
}

export const PATCH = withApiLogging("PATCH /api/guidance-program/entries/[id]", handlePatch);
