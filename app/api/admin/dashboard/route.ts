import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { computeRisk } from "@/lib/server/risk/compute-risk";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withTtlCache } from "@/lib/server/cache/ttl-cache";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Bu uç, öğrenci rosterinin TAMAMINI (net/devam/ödev geçmişiyle) tarayıp
// risk skorunu her istekte yeniden hesaplıyor — kurum büyüdükçe (100'lerce
// öğrenci) pahalılaşan bir agregasyon. Dashboard'un saniye saniye canlı
// olması gerekmediği için (bkz. FAZ 6 planı) kısa bir TTL ile önbelleklenir;
// segment DEĞİŞTİĞİNDE farklı bir anahtara düşer, o yüzden segment
// filtrelemesi asla bayat veri göstermez — sadece AYNI segmentin kendisi
// TTL süresince tazelenmez.
const DASHBOARD_CACHE_TTL_MS = 20_000;

// GET /api/admin/dashboard?segment=ALL|LGS|YKS|MEZUN|5..12 — Yönetici panelinin
// üst istatistik şeridi, "Genel Bakış" sekmesi ve ilgili 5 modal (Şubeler,
// Kadro, Deneme Yükleme, Risk Kutusu, Öğrenci listesi) İÇİN TEK gerçek veri
// kaynağı — hepsi aynı segment-filtrelenmiş gerçek DB sorgusunu paylaşır.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const segment = request.nextUrl.searchParams.get("segment") ?? "ALL";

    const payload = await withTtlCache(
      `admin-dashboard:${session.institutionId}:${segment}`,
      DASHBOARD_CACHE_TTL_MS,
      () => computeDashboard(session.institutionId, segment)
    );

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_dashboard_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// "ALL"/"LGS"/"YKS"/"MEZUN"/sınıf-seviyesi segment filtresini (bkz.
// lib/server/segment.ts > branchMatchesSegment, tek gerçek mantık kaynağı
// budur) doğrudan Prisma `where`'e çevirir — önceden TÜM şubeler çekilip
// JS'te filtreleniyordu, şimdi eşleşmeyen şubeler DB'den hiç dönmüyor.
function branchWhereForSegment(institutionId: string, segment: string): Prisma.BranchWhereInput {
  if (segment === "LGS" || segment === "YKS" || segment === "MEZUN") return { institutionId, segment };
  const gradeNum = Number(segment);
  if (!Number.isNaN(gradeNum)) return { institutionId, grade: gradeNum };
  return { institutionId }; // "ALL" veya tanınmayan değer — hepsini say
}

async function computeDashboard(institutionId: string, segment: string) {
  const branchWhere = branchWhereForSegment(institutionId, segment);

  // ⚠️ Önceki sürüm burada 3 AYRI SIRALI aşama vardı: şubeleri çek → onların
  // id'leriyle öğrencileri çek → öğrencilerin id'leriyle devam/ödev say —
  // her aşama bir önceki aşamanın sonucuna (id listesine) muhtaç olduğu için
  // Promise.all bile 3 ayrı ağ round-trip'ini engelleyemiyordu. Canlıda
  // ölçüldü: veri hacmi neredeyse SIFIR olan (eşleşen şubesi olmayan bir
  // segment) bir istek bile ~1.1sn sürüyordu — demek ki asıl maliyet artık
  // SATIR HACMİ değil, round-trip SAYISIYDI (bu makineden Neon'a her round-
  // trip ~300-400ms). Çözüm: öğrenci/devam/ödev sorgularının hiçbiri artık
  // şubelerin ÖNCE ÇEKİLİP id listesine indirgenmesini beklemiyor — aynı
  // `branchWhere` koşulunu `branch: {...}` ilişki filtresiyle DOĞRUDAN
  // uyguluyorlar, bu yüzden TÜMÜ aynı anda, TEK round-trip turunda çalışır.
  // Son sınavın sonuç sayısı da ayrı bir sorgu yerine `_count` ilişki
  // seçimiyle AYNI sorguda geliyor — ikinci aşamayı da ortadan kaldırır.
  const [branches, teachers, latestExamRow, students, attendanceCounts, homeworkCounts] = await Promise.all([
    prisma.branch.findMany({
      where: branchWhere,
      include: { advisor: { select: { firstName: true, lastName: true } } },
      orderBy: { grade: "asc" },
    }),
    prisma.teacher.findMany({
      where: { institutionId },
      include: { teachingBranches: { select: { id: true, name: true } } },
    }),
    prisma.exam.findFirst({
      where: { institutionId },
      orderBy: { examDate: "desc" },
      include: { _count: { select: { results: true } } },
    }),
    prisma.student.findMany({
      where: { branch: branchWhere },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        branchId: true,
        targetNet: true,
        branch: { select: { name: true } },
        netResults: { select: { net: true, examId: true, exam: { select: { name: true, examDate: true } } } },
      },
    }),
    // ⚠️ Önceki sürüm attendanceRecords/homeworkSubmissions'ı HER öğrenci
    // için TAM geçmişiyle (bir akademik yılda öğrenci başına yüzlerce satır)
    // çekip oranı JS'te satır satır indirgiyordu — 16 öğrencide bile
    // dashboard'un 2-3 saniye sürmesinin asıl nedeni buydu (canlıda
    // doğrulandı). Sadece ORAN gerektiği için ham satır yerine groupBy ile
    // öğrenci başına durum sayıları çekiliyor.
    prisma.attendanceRecord.groupBy({ by: ["studentId", "status"], where: { student: { branch: branchWhere } }, _count: true }),
    prisma.homeworkSubmission.groupBy({ by: ["studentId", "status"], where: { student: { branch: branchWhere } }, _count: true }),
  ]);
  const branchIds = branches.map((b) => b.id);
  const latestExamResultCount = latestExamRow?._count.results ?? 0;

  const attendanceByStudent = new Map<string, { presentOrLate: number; total: number }>();
  for (const row of attendanceCounts) {
    const entry = attendanceByStudent.get(row.studentId) ?? { presentOrLate: 0, total: 0 };
    entry.total += row._count;
    if (row.status === "PRESENT" || row.status === "LATE") entry.presentOrLate += row._count;
    attendanceByStudent.set(row.studentId, entry);
  }
  const homeworkByStudent = new Map<string, { done: number; total: number }>();
  for (const row of homeworkCounts) {
    const entry = homeworkByStudent.get(row.studentId) ?? { done: 0, total: 0 };
    entry.total += row._count;
    if (row.status === "DONE") entry.done += row._count;
    homeworkByStudent.set(row.studentId, entry);
  }

  const staff = teachers
    .filter((t) => t.teachingBranches.some((b) => branchIds.includes(b.id)))
    .map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
      subject: t.subject,
      branchNames: t.teachingBranches.filter((b) => branchIds.includes(b.id)).map((b) => b.name),
    }));

  // Öğrenci bazlı: güncel net (en son denemedeki branş netlerinin toplamı),
  // devam oranı, ödev tamamlama, risk skoru — hepsi gerçek sinyalden.
  const studentRows = students.map((s) => {
    // ⚠️ netResults hiçbir ORDER BY olmadan geliyordu — computeRisk'in
    // erken/geç yarı karşılaştırması (bkz. lib/server/risk/compute-risk.ts)
    // dizinin KRONOLOJİK sırada olduğunu varsayıyor; garanti olmadığı için
    // burada açıkça tarihe göre sıralanıyor (aksi halde risk skoru rastgele
    // hatalı çıkabilirdi — bununla uğraşırken fark edilen ayrı bir doğruluk
    // sorunu, performansla ilgisi yok).
    const sortedResults = [...s.netResults].sort((a, b) => a.exam.examDate.getTime() - b.exam.examDate.getTime());
    const latestExamId = sortedResults[sortedResults.length - 1]?.examId ?? null;
    const actualNet = latestExamId
      ? Math.round(s.netResults.filter((r) => r.examId === latestExamId).reduce((sum, r) => sum + r.net, 0) * 100) / 100
      : null;
    const att = attendanceByStudent.get(s.id);
    const attendanceRate = att && att.total > 0 ? Math.round((att.presentOrLate / att.total) * 100) : 100;
    const hw = homeworkByStudent.get(s.id);
    const homeworkTotal = hw?.total ?? 0;
    const homeworkDone = hw?.done ?? 0;
    const homeworkSuccessRate = homeworkTotal === 0 ? null : Math.round((homeworkDone / homeworkTotal) * 100);
    const { riskScore, reason } = computeRisk({ attendanceRate, homeworkSuccessRate, nets: sortedResults.map((r) => r.net) });
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      branchId: s.branchId,
      branch: s.branch.name,
      actualNet,
      homeworkTotal,
      homeworkDone,
      riskScore,
      riskReason: reason,
    };
  });

  const totalStudents = studentRows.length;
  const activeBranches = branches.length;
  const totalHomework = studentRows.reduce((sum, s) => sum + s.homeworkTotal, 0);
  const doneHomework = studentRows.reduce((sum, s) => sum + s.homeworkDone, 0);
  const avgCompletion = totalHomework === 0 ? 0 : Math.round((doneHomework / totalHomework) * 100);
  const riskyStudents = studentRows.filter((s) => s.riskScore >= 70).sort((a, b) => b.riskScore - a.riskScore);

  const branchRows = branches.map((b) => {
    const inBranch = studentRows.filter((s) => s.branchId === b.id);
    const hw = inBranch.reduce((sum, s) => sum + s.homeworkTotal, 0);
    const done = inBranch.reduce((sum, s) => sum + s.homeworkDone, 0);
    return {
      id: b.id,
      name: b.name,
      advisorName: b.advisor ? `${b.advisor.firstName} ${b.advisor.lastName}` : null,
      studentCount: inBranch.length,
      completionRate: hw === 0 ? 0 : Math.round((done / hw) * 100),
    };
  });

  // Sınav bazlı net trendi: "hedef" segmentin gerçek Student.targetNet
  // ortalaması (sabit referans çizgisi), "gerçekleşen" o sınavdaki gerçek
  // ortalama net — ikisi de gerçek veriden, uydurma aylık veri yok.
  const targets = students.map((s) => s.targetNet).filter((t): t is number => t !== null);
  const avgTarget = targets.length > 0 ? Math.round((targets.reduce((sum, t) => sum + t, 0) / targets.length) * 100) / 100 : null;

  const examMap = new Map<string, { name: string; examDate: Date; nets: number[] }>();
  for (const s of students) {
    for (const r of s.netResults) {
      const entry = examMap.get(r.examId) ?? { name: r.exam.name, examDate: r.exam.examDate, nets: [] };
      entry.nets.push(r.net);
      examMap.set(r.examId, entry);
    }
  }
  const examNetTrend = [...examMap.values()]
    .sort((a, b) => a.examDate.getTime() - b.examDate.getTime())
    .map((e) => ({
      examName: e.name,
      target: avgTarget,
      actual: Math.round((e.nets.reduce((sum, n) => sum + n, 0) / e.nets.length) * 100) / 100,
    }));

  const latestExam = latestExamRow ? { name: latestExamRow.name, examDate: latestExamRow.examDate, resultCount: latestExamResultCount } : null;

  return {
    totalStudents,
    activeBranches,
    avgCompletion,
    riskyStudentCount: riskyStudents.length,
    branches: branchRows,
    staff,
    students: studentRows.map((s) => ({ id: s.id, name: s.name, branch: s.branch, actualNet: s.actualNet })),
    riskyStudents: riskyStudents.map((s) => ({ id: s.id, name: s.name, branch: s.branch, riskScore: s.riskScore, reason: s.riskReason })),
    examNetTrend,
    latestExam,
  };
}

export const GET = withApiLogging("GET /api/admin/dashboard", handleGet);
