import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// PATCH /api/guidance/meetings/[id] — görüşmenin sonucunu işaretle.
//
// ⚠️ Sahiplik: görüşmeyi yalnızca AÇAN rehber öğretmen değiştirebilir
// (counselorId === session.sub). Kurum kontrolü de ayrıca yapılır, çünkü
// "aynı kurumda mı" ile "benim görüşmem mi" farklı sorular.
//
// "Gelmedi" (NO_SHOW) ayrı bir durum: iptal edilen görüşmeyle gelmeyen
// öğrenci aynı şey değil — ikincisi rehberlik açısından bir SİNYALDİR,
// takip gerektirir.
const patchSchema = z.object({
  status: z.enum(["PLANNED", "DONE", "NO_SHOW", "CANCELLED"]).optional(),
  outcomeNote: z.string().trim().max(2000).optional(),
  scheduledAt: z.string().min(1).optional(),
});

async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance");

    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
    }

    const meeting = await prisma.guidanceMeeting.findUnique({
      where: { id: params.id },
      select: { counselorId: true, student: { select: { institutionId: true } } },
    });
    if (!meeting) return NextResponse.json({ error: "Görüşme bulunamadı." }, { status: 404 });
    requireInstitution(session, meeting.student.institutionId);
    if (meeting.counselorId !== session.sub) {
      // 404 — başkasının görüşmesinin VARLIĞINI da sızdırma
      // (requireInstitution'daki aynı gerekçe).
      return NextResponse.json({ error: "Görüşme bulunamadı." }, { status: 404 });
    }

    const when = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined;
    if (when && Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Geçersiz görüşme tarihi." }, { status: 400 });
    }

    await prisma.guidanceMeeting.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.outcomeNote !== undefined ? { outcomeNote: parsed.data.outcomeNote || null } : {}),
        ...(when ? { scheduledAt: when } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_meeting_update_failed", error);
  }
}

export const PATCH = withApiLogging("PATCH /api/guidance/meetings/[id]", handlePatch);
