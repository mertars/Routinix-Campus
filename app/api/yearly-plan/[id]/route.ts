import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// PATCH /api/yearly-plan/[id] — { covered: boolean }. Yıllık plandaki bir
// haftanın "işlendi" tikini değiştirir — kullanıcı bulgusu: bu tikleme
// hiç yoktu.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json().catch(() => null);
    if (typeof body?.covered !== "boolean") {
      return NextResponse.json({ error: "covered (boolean) zorunludur." }, { status: 400 });
    }

    const existing = await prisma.yearlyPlanRow.findUnique({ where: { id: params.id }, select: { teacherId: true } });
    if (!existing || existing.teacherId !== session.sub) {
      return NextResponse.json({ error: "Plan satırı bulunamadı." }, { status: 404 });
    }

    const row = await prisma.yearlyPlanRow.update({ where: { id: params.id }, data: { covered: body.covered } });
    return NextResponse.json({ row });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("yearly_plan_update_failed", error);
  }
}

export const PATCH = withApiLogging("PATCH /api/yearly-plan/[id]", handlePatch);
