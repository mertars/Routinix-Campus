import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) return NextResponse.json({ error: "teacherId parametresi zorunludur." }, { status: 400 });
    if (session.role === "TEACHER") {
      if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
    } else {
      requireRole(session, "principal");
    }
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }
    // ⚠️ Eskiden `createdAt desc` kullanılıyordu — en son eklenen satır
    // (genelde en yüksek hafta numarası) en üste çıkıyor, 1. hafta dibe
    // batıyordu (bkz. weekOrder alanının şema yorumu). Artık ekleniş
    // SIRASINA (weekOrder asc) göre — hafta 1 üstte, son hafta altta.
    const rows = await prisma.yearlyPlanRow.findMany({ where: { teacherId }, orderBy: { weekOrder: "asc" } });
    return NextResponse.json({ rows });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("yearly_plan_list_failed", error);
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const body = await request.json();
    const { weekLabel, subtopicName, notes, grade } = body as {
      weekLabel?: string;
      subtopicName?: string;
      notes?: string;
      grade?: number;
    };
    if (!weekLabel?.trim() || !subtopicName?.trim()) {
      return NextResponse.json({ error: "weekLabel ve subtopicName zorunludur." }, { status: 400 });
    }

    // weekOrder — ekleniş sırasını KALICI olarak tutar (bkz. GET'teki
    // orderBy notu). Bu öğretmenin şu ana kadarki en yüksek sırasının
    // bir fazlası.
    const last = await prisma.yearlyPlanRow.findFirst({ where: { teacherId }, orderBy: { weekOrder: "desc" }, select: { weekOrder: true } });
    const nextWeekOrder = (last?.weekOrder ?? 0) + 1;

    const created = await prisma.yearlyPlanRow.create({
      data: {
        teacherId,
        weekLabel: weekLabel.trim(),
        subtopicName: subtopicName.trim(),
        notes: notes?.trim() || null,
        grade: typeof grade === "number" ? grade : null,
        weekOrder: nextWeekOrder,
      },
    });
    return NextResponse.json({ row: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("yearly_plan_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/yearly-plan", handleGet);
export const POST = withApiLogging("POST /api/yearly-plan", handlePost);
