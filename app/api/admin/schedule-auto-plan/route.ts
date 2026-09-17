import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { buildAutoPlan } from "@/lib/server/schedule/auto-plan";
import { SCHEDULE_DAYS } from "@/lib/mock-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/schedule-auto-plan — { dryRun, keepExisting }
//
// ⚠️ NEDEN VAR (Mert, 2026-09-18): "çakışmasız ders programında otomatik bir
// plan oluşturucu yap ama akıllı çalışsın; yaptıktan sonra her sınıfı hangi
// derslerden sorumlu tuttun bana çıktısını ver, yanlış varsa ben
// düzeltirim."
//
// ⚠️ İKİ AŞAMALI ve VARSAYILAN ÖNİZLEME (dryRun): plan, öğretmenlerin
// haftasını baştan yazan bir işlem. Yönetici önce SORUMLU DERS TABLOSUNU
// ve boş kalan hücreleri görür, onaylarsa uygulanır. Tek adımlı olsaydı
// yanlış bir alan bilgisi yüzünden 12 şubenin programı sessizce bozulurdu.
//
// ⚠️ VAR OLAN PROGRAM KORUNUR (keepExisting, varsayılan true): kurumun elle
// kurduğu dersler üzerine yazılmaz, yalnızca BOŞ hücreler doldurulur.
// keepExisting=false istenirse önce silinir — ama o silme de dryRun'da
// kaç satırın gideceğini söyler.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const dryRun = body?.dryRun !== false;
    const keepExisting = body?.keepExisting !== false;

    const [branches, teachers, slotDefs, blocked, existing] = await Promise.all([
      prisma.branch.findMany({
        where: { institutionId: session.institutionId },
        select: { id: true, name: true, grade: true, track: true },
      }),
      prisma.teacher.findMany({
        where: { institutionId: session.institutionId, isActive: true, subject: { not: "Rehberlik" } },
        select: { id: true, firstName: true, lastName: true, subject: true },
      }),
      prisma.scheduleSlotDefinition.findMany({
        where: { institutionId: session.institutionId },
        select: { label: true },
        orderBy: { label: "asc" },
      }),
      prisma.teacherUnavailability.findMany({
        where: { teacher: { institutionId: session.institutionId } },
        select: { teacherId: true, day: true, slot: true },
      }),
      prisma.lessonSlot.findMany({
        where: { branch: { institutionId: session.institutionId } },
        select: { id: true, branchId: true, day: true, slot: true, teacherId: true, subject: true },
      }),
    ]);

    if (branches.length === 0) return NextResponse.json({ error: "Kurumda şube yok." }, { status: 400 });
    if (slotDefs.length === 0) return NextResponse.json({ error: "Önce ders saatlerini tanımlayın." }, { status: 400 });

    const result = buildAutoPlan({
      branches,
      teachers: teachers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`, subject: t.subject })),
      days: SCHEDULE_DAYS,
      slots: slotDefs.map((s) => s.label),
      blocked,
      existing: keepExisting
        ? existing.map((e) => ({ branchId: e.branchId, day: e.day, slot: e.slot, teacherId: e.teacherId, subject: e.subject }))
        : [],
    });

    const teacherById = new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));
    const preview = {
      ...result,
      assignments: result.assignments.map((a) => ({ ...a, teacherName: teacherById.get(a.teacherId) ?? "" })),
      willDelete: keepExisting ? 0 : existing.length,
      keepExisting,
    };

    if (dryRun) return NextResponse.json({ ...preview, applied: false });

    // UYGULAMA. Silme, ID listesiyle daraltılır (bkz. lib/server/db-guard.ts —
    // toplu yazma koruması sahiplik anahtarı ister; ayrıca silinen satırlar
    // çöp kutusuna düşer, bkz. lib/server/db-archive.ts).
    if (!keepExisting && existing.length > 0) {
      await prisma.lessonSlot.deleteMany({ where: { id: { in: existing.map((e) => e.id) } } });
    }
    let created = 0;
    if (result.assignments.length > 0) {
      const res = await prisma.lessonSlot.createMany({
        data: result.assignments.map((a) => ({
          branchId: a.branchId,
          day: a.day,
          slot: a.slot,
          teacherId: a.teacherId,
          subject: a.subject,
        })),
        skipDuplicates: true,
      });
      created = res.count;
    }

    logger.warn("schedule_auto_plan_applied", {
      institutionId: session.institutionId,
      by: session.sub,
      created,
      deleted: keepExisting ? 0 : existing.length,
      branches: branches.length,
    });

    return NextResponse.json({ ...preview, applied: true, created, deleted: keepExisting ? 0 : existing.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("schedule_auto_plan_failed", error);
  }
}

export const POST = withApiLogging("POST /api/admin/schedule-auto-plan", handlePost);
