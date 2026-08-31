import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type TrackingRow = {
  id: string;
  testType: "genel" | "alt_konu" | "comprehension";
  studentId: string;
  studentName: string;
  branchName: string;
  grade: number;
  subtopicName: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
  daysSinceAssigned: number;
};

// GET /api/xray/assignment-tracking?subject=Matematik&status=pending&minDaysOverdue=2
// — Faz Z7: kurum genelinde TÜM Röntgen atamalarının (Test 1 "genel"/
// "alt_konu" + Test 2 comprehension) tek bir listede birleştirilmiş hâli.
// Mevcut atama panelleri (xray-practice-assignment-section.tsx vb.) SADECE
// o an seçili TEK öğrencinin atamalarını gösteriyordu — "kim ödevini
// yapmadı" sorusuna kurum genelinde cevap veren bir ekran yoktu. Bu route
// o boşluğu dolduruyor; status/minDaysOverdue filtreleri veritabanı
// tarafında DEĞİL (3 farklı tablodan gelen sonuçları birleştirmek
// gerektiğinden) JS tarafında uygulanıyor — kurum ölçeğinde (yüzlerce
// atama) bu tamamen yeterli, ham SQL/UNION gerektirmiyor.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });
    const statusFilter = request.nextUrl.searchParams.get("status"); // "pending" | "completed" | null
    const minDaysOverdue = Number(request.nextUrl.searchParams.get("minDaysOverdue") ?? 0);

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }

    const studentSelect = { select: { firstName: true, lastName: true, branch: { select: { name: true, grade: true } } } } as const;

    const [practiceAttempts, comprehensionAssignments] = await Promise.all([
      prisma.xrayPracticeAttempt.findMany({
        where: { subject: subject.trim(), student: { institutionId: session.institutionId } },
        select: { id: true, studentId: true, subtopicId: true, variant: true, status: true, assignedAt: true, completedAt: true, student: studentSelect },
      }),
      prisma.xrayComprehensionAssignment.findMany({
        where: { subject: subject.trim(), student: { institutionId: session.institutionId } },
        select: { id: true, studentId: true, subtopicId: true, status: true, assignedAt: true, completedAt: true, student: studentSelect },
      }),
    ]);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const rows: TrackingRow[] = [
      ...practiceAttempts.map((a): TrackingRow => ({
        id: a.id,
        testType: a.variant === "alt_konu" ? "alt_konu" : "genel",
        studentId: a.studentId,
        studentName: `${a.student.firstName} ${a.student.lastName}`,
        branchName: a.student.branch?.name ?? "—",
        grade: a.student.branch?.grade ?? 0,
        subtopicName: subtopicNameById.get(a.subtopicId) ?? a.subtopicId,
        status: a.status,
        assignedAt: a.assignedAt.toISOString(),
        completedAt: a.completedAt?.toISOString() ?? null,
        daysSinceAssigned: Math.floor((now - a.assignedAt.getTime()) / dayMs),
      })),
      ...comprehensionAssignments.map((a): TrackingRow => ({
        id: a.id,
        testType: "comprehension",
        studentId: a.studentId,
        studentName: `${a.student.firstName} ${a.student.lastName}`,
        branchName: a.student.branch?.name ?? "—",
        grade: a.student.branch?.grade ?? 0,
        subtopicName: subtopicNameById.get(a.subtopicId) ?? a.subtopicId,
        status: a.status,
        assignedAt: a.assignedAt.toISOString(),
        completedAt: a.completedAt?.toISOString() ?? null,
        daysSinceAssigned: Math.floor((now - a.assignedAt.getTime()) / dayMs),
      })),
    ];

    const isPending = (r: TrackingRow) => r.status === "ASSIGNED" || r.status === "IN_PROGRESS";
    let filtered = rows;
    if (statusFilter === "pending") filtered = filtered.filter(isPending);
    else if (statusFilter === "completed") filtered = filtered.filter((r) => !isPending(r));
    if (minDaysOverdue > 0) filtered = filtered.filter((r) => isPending(r) && r.daysSinceAssigned >= minDaysOverdue);

    // "Bekleyen" görünümünde EN ESKİ (en gecikmiş, en acil) atama ÖNCE
    // gelir — DESC sıralasaydık en acil öğrenciler listenin dibine
    // gömülürdü, "N+ gündür bekleyen" filtresinin amacını baltalardı.
    // "Tamamlanan"/"Tümü" görünümünde en yeni önce (özet/recap mantığı).
    filtered.sort((a, b) => {
      const diff = new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime();
      return statusFilter === "pending" ? diff : -diff;
    });

    const totals = { total: rows.length, pending: rows.filter(isPending).length, completed: rows.filter((r) => !isPending(r)).length };

    return NextResponse.json({ rows: filtered, totals });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_assignment_tracking_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/assignment-tracking", handleGet);
