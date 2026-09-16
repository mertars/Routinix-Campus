import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// PROGRAM TAKİBİ — "yazdığım planlara ne kadar uyuldu?"
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "rehberliğin yaptığı planlara ne kadar
// uyulmuş onu görebileceği bir ekran tasarla". Program yazılıyordu,
// öğrenci panelinde blokları işaretleyebiliyordu, ama rehberlik bunu
// ancak öğrenci öğrenci dosya açarak görebiliyordu — kurum genelinde
// "kim yapıyor, kim yapmıyor" sorusunun cevabı hiçbir ekranda yoktu.
//
// ⚠️ TAMAMLANMA ÖLÇÜTÜ blok türüne göre değişir ve GET /api/guidance-program
// ile AYNI kuralı kullanır (tek gerçek olsun diye):
//   VIDEO      → videonun en az %90'ı izlendiyse (süre biliniyorsa),
//                yoksa ilk oynatma damgası; ya da elle işaretlenmişse.
//   XRAY_TEST  → atama COMPLETED ise; ya da elle işaretlenmişse.
//   diğerleri  → öğrencinin elle işaretlemesi (completedAt).
const WATCHED_RATIO_DONE = 0.9;
const DEFAULT_WEEKS = 4;

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance", "principal");

    const weeks = Math.min(12, Math.max(1, Number(request.nextUrl.searchParams.get("weeks") ?? DEFAULT_WEEKS) || DEFAULT_WEEKS));
    const since = new Date(Date.now() - weeks * 7 * 86_400_000);

    const programs = await prisma.guidanceProgram.findMany({
      where: { student: { institutionId: session.institutionId }, createdAt: { gte: since } },
      select: {
        id: true,
        weekLabel: true,
        createdAt: true,
        student: { select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } } },
        entries: {
          select: {
            id: true,
            kind: true,
            completedAt: true,
            videoId: true,
            video: { select: { durationSeconds: true } },
            xrayAssignment: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Video izleme durumu tek sorguda — blok başına sorgu N tur demekti.
    const pairs = programs.flatMap((p) =>
      p.entries.filter((e) => e.videoId).map((e) => ({ studentId: p.student.id, videoId: e.videoId as string }))
    );
    const watchRows = pairs.length
      ? await prisma.videoAssignment.findMany({
          where: {
            studentId: { in: [...new Set(pairs.map((x) => x.studentId))] },
            videoId: { in: [...new Set(pairs.map((x) => x.videoId))] },
          },
          select: { studentId: true, videoId: true, watchedAt: true, watchedSeconds: true },
        })
      : [];
    const watchBy = new Map(watchRows.map((w) => [`${w.studentId}|${w.videoId}`, w]));

    function isDone(
      studentId: string,
      e: { kind: string; completedAt: Date | null; videoId: string | null; video: { durationSeconds: number | null } | null; xrayAssignment: { status: string } | null }
    ): boolean {
      if (e.completedAt) return true;
      if (e.kind === "VIDEO" && e.videoId) {
        const w = watchBy.get(`${studentId}|${e.videoId}`);
        if (!w) return false;
        if (w.watchedSeconds && e.video?.durationSeconds) return w.watchedSeconds / e.video.durationSeconds >= WATCHED_RATIO_DONE;
        return !!w.watchedAt;
      }
      if (e.kind === "XRAY_TEST") return e.xrayAssignment?.status === "COMPLETED";
      return false;
    }

    // Öğrenci bazında topla — rehberliğin sorusu "kim yapmıyor".
    type Row = {
      studentId: string;
      studentName: string;
      branchName: string | null;
      programCount: number;
      total: number;
      done: number;
      lastProgramAt: string;
      lastProgramLabel: string;
      byKind: Record<string, { total: number; done: number }>;
    };
    const byStudent = new Map<string, Row>();
    for (const p of programs) {
      const key = p.student.id;
      const row =
        byStudent.get(key) ??
        {
          studentId: key,
          studentName: `${p.student.firstName} ${p.student.lastName}`,
          branchName: p.student.branch?.name ?? null,
          programCount: 0,
          total: 0,
          done: 0,
          lastProgramAt: p.createdAt.toISOString(),
          lastProgramLabel: p.weekLabel,
          byKind: {},
        };
      row.programCount += 1;
      for (const e of p.entries) {
        const done = isDone(key, e);
        row.total += 1;
        if (done) row.done += 1;
        const k = row.byKind[e.kind] ?? { total: 0, done: 0 };
        k.total += 1;
        if (done) k.done += 1;
        row.byKind[e.kind] = k;
      }
      byStudent.set(key, row);
    }

    const rows = [...byStudent.values()]
      .map((r) => ({ ...r, percent: r.total > 0 ? Math.round((r.done / r.total) * 100) : null }))
      // En düşük uyum en üstte — bu ekranın amacı "kim yapmıyor".
      .sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101));

    const totalBlocks = rows.reduce((s, r) => s + r.total, 0);
    const doneBlocks = rows.reduce((s, r) => s + r.done, 0);

    return NextResponse.json({
      weeks,
      summary: {
        studentCount: rows.length,
        programCount: programs.length,
        totalBlocks,
        doneBlocks,
        percent: totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : null,
      },
      rows,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_program_compliance_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/program-compliance", handleGet);
