import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/guidance/students?q=... — rehberliğin öğrenci listesi.
//
// ⚠️ Neden ayrı bir uç: /api/students ŞUBE bazlı çalışıyor (öğretmen kendi
// sınıflarını çeker). Rehberlik şubeye bağlı DEĞİL, kurum genelinde çalışır
// (bkz. lib/server/auth/jwt.ts'teki Rehberlik personası notu) — ve ona
// gereken şey ham liste değil, REHBERLİK BAĞLAMI: bu öğrencinin açık sevki
// var mı, en son ne zaman görüşülmüş, kaç not var.
//
// Rehberlik paneli açılınca ilk sorusu "kiminle ilgilenmem gerekiyor" —
// liste bu soruya göre sıralanır: açık sevki olanlar önce, sonra en uzun
// süredir görüşülmeyenler.
const PAGE_SIZE = 40;

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance", "principal");

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

    const students = await prisma.student.findMany({
      where: {
        institutionId: session.institutionId,
        isActive: true,
        ...(q.length >= 2
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { studentNumber: { contains: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentNumber: true,
        branch: { select: { name: true, grade: true } },
        // Not METNİ burada DÖNMEZ — liste ekranında gizli bir görüşme
        // notunun içeriğinin görünmesine gerek yok, sadece "ne zaman" ve
        // "kaç tane" bilgisi taşınır (bkz. Öğrenci 360'taki aynı kural).
        guidanceNotes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { guidanceNotes: true } },
        guidanceReferrals: {
          where: { status: "PENDING" },
          select: { id: true, reason: true, createdAt: true, teacher: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: PAGE_SIZE,
    });

    const rows = students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      studentNumber: s.studentNumber,
      branchName: s.branch?.name ?? "—",
      grade: s.branch?.grade ?? null,
      noteCount: s._count.guidanceNotes,
      lastNoteAt: s.guidanceNotes[0]?.createdAt?.toISOString() ?? null,
      openReferrals: s.guidanceReferrals.map((r) => ({
        id: r.id,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        teacherName: `${r.teacher.firstName} ${r.teacher.lastName}`,
      })),
    }));

    // Öncelik: açık sevki olanlar → hiç görüşülmemişler → en eski görüşme.
    rows.sort((a, b) => {
      if (a.openReferrals.length !== b.openReferrals.length) return b.openReferrals.length - a.openReferrals.length;
      if (!a.lastNoteAt && b.lastNoteAt) return -1;
      if (a.lastNoteAt && !b.lastNoteAt) return 1;
      if (a.lastNoteAt && b.lastNoteAt) return a.lastNoteAt.localeCompare(b.lastNoteAt);
      return a.name.localeCompare(b.name, "tr");
    });

    return NextResponse.json({ students: rows });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_students_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/students", handleGet);
