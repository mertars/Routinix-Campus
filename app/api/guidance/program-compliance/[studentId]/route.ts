import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// TEK ÖĞRENCİNİN PROGRAM UYUM DÖKÜMÜ — "İncele" ekranının verisi.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16: "program takibinde alttaki ekran kafa
// karıştırıcı, incele butonu olsun, direkt o ekranda tabloları olsun").
// Liste ekranı tek bir yüzde gösteriyordu; "neden %0" sorusunun cevabı
// (hangi gün, hangi blok, hangi ders yapılmadı) hiçbir yerde yoktu.
const WATCHED_RATIO_DONE = 0.9;

async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance", "principal");

    const weeks = Math.min(12, Math.max(1, Number(request.nextUrl.searchParams.get("weeks") ?? 4) || 4));
    const since = new Date(Date.now() - weeks * 7 * 86_400_000);

    const student = await prisma.student.findUnique({
      where: { id: params.studentId },
      select: { id: true, firstName: true, lastName: true, institutionId: true, branch: { select: { name: true } } },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const programs = await prisma.guidanceProgram.findMany({
      where: { studentId: student.id, createdAt: { gte: since } },
      select: {
        id: true,
        weekLabel: true,
        createdAt: true,
        entries: {
          select: {
            id: true,
            day: true,
            time: true,
            subject: true,
            topic: true,
            kind: true,
            questionTarget: true,
            note: true,
            completedAt: true,
            videoId: true,
            video: { select: { title: true, durationSeconds: true } },
            xrayAssignment: { select: { status: true, completedAt: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const videoIds = [...new Set(programs.flatMap((p) => p.entries.map((e) => e.videoId).filter((v): v is string => !!v)))];
    const watchRows = videoIds.length
      ? await prisma.videoAssignment.findMany({
          where: { studentId: student.id, videoId: { in: videoIds } },
          select: { videoId: true, watchedAt: true, watchedSeconds: true },
        })
      : [];
    const watchBy = new Map(watchRows.map((w) => [w.videoId, w]));

    const rows = programs.map((p) => ({
      id: p.id,
      weekLabel: p.weekLabel,
      createdAt: p.createdAt.toISOString(),
      entries: p.entries.map((e) => {
        const w = e.videoId ? watchBy.get(e.videoId) : null;
        const watchedPercent =
          w?.watchedSeconds && e.video?.durationSeconds
            ? Math.min(100, Math.round((w.watchedSeconds / e.video.durationSeconds) * 100))
            : null;
        const done = e.completedAt
          ? true
          : e.kind === "VIDEO"
            ? watchedPercent !== null
              ? watchedPercent >= WATCHED_RATIO_DONE * 100
              : !!w?.watchedAt
            : e.kind === "XRAY_TEST"
              ? e.xrayAssignment?.status === "COMPLETED"
              : false;
        return {
          id: e.id,
          day: e.day,
          time: e.time,
          subject: e.subject,
          topic: e.topic,
          kind: e.kind,
          questionTarget: e.questionTarget,
          note: e.note,
          videoTitle: e.video?.title ?? null,
          watchedPercent,
          xrayStatus: e.xrayAssignment?.status ?? null,
          done,
          completedAt: e.completedAt?.toISOString() ?? null,
        };
      }),
    }));

    // Ders bazlı döküm — "hangi derste takılıyor" sorusu tek yüzdeyle
    // görülemiyordu.
    const bySubject = new Map<string, { total: number; done: number }>();
    const byKind = new Map<string, { total: number; done: number }>();
    for (const p of rows) {
      for (const e of p.entries) {
        for (const [map, key] of [
          [bySubject, e.subject || "Genel"],
          [byKind, e.kind],
        ] as const) {
          const cur = map.get(key) ?? { total: 0, done: 0 };
          cur.total += 1;
          if (e.done) cur.done += 1;
          map.set(key, cur);
        }
      }
    }

    const total = rows.reduce((s, p) => s + p.entries.length, 0);
    const done = rows.reduce((s, p) => s + p.entries.filter((e) => e.done).length, 0);

    return NextResponse.json({
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        branchName: student.branch?.name ?? null,
      },
      weeks,
      summary: { total, done, percent: total > 0 ? Math.round((done / total) * 100) : null, programCount: rows.length },
      bySubject: [...bySubject.entries()]
        .map(([subject, v]) => ({ subject, ...v, percent: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0 }))
        .sort((a, b) => a.percent - b.percent),
      byKind: [...byKind.entries()].map(([kind, v]) => ({ kind, ...v })),
      programs: rows,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_program_compliance_detail_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/program-compliance/[studentId]", handleGet);
