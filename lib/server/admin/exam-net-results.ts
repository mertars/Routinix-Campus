import { prisma } from "@/lib/server/prisma";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { syncExamResultToRoentgen } from "@/lib/server/exams/subtopic-breakdown";

export type RosterStudentForMatching = {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  studentNumber: string;
  branchId: string;
  branchName: string;
};

// Deneme sonucu içe aktarma sihirbazının öğrenci eşleştirme adımı için —
// BİLEREK lib/server/admin/directory.ts > listStudentDirectory'den AYRI:
// o genel amaçlı roster ucu (arama/filtre, kadro listesi ekranı) T.C. No
// döndürmez — burada PDF satırlarını gerçek öğrenciyle eşleştirmek için
// gerekli, bu yüzden ayrı ve dar kapsamlı tutuldu.
export async function listStudentRosterForMatching(institutionId: string): Promise<RosterStudentForMatching[]> {
  const students = await prisma.student.findMany({
    where: { institutionId, isActive: true },
    select: { id: true, firstName: true, lastName: true, nationalId: true, studentNumber: true, branch: { select: { id: true, name: true } } },
    orderBy: [{ firstName: "asc" }],
  });
  return students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    nationalId: s.nationalId,
    studentNumber: s.studentNumber,
    branchId: s.branch.id,
    branchName: s.branch.name,
  }));
}

export type NetResultRow = {
  studentId: string;
  subject: string;
  net: number;
  // Kazanım bazlı deneme analizi (2026-09-05) — bu ikisi VERİLİRSE ve o
  // sınav+ders için bir cevap anahtarı (ExamQuestion) tanımlıysa, konu
  // bazlı kırılım hesaplanıp Matematik/Fizik'te Röntgen'e de yazılır
  // (bkz. lib/server/exams/subtopic-breakdown.ts). Verilmezse (undefined)
  // sadece ders bazlı net kaydedilir, mevcut davranış AYNEN korunur.
  wrongQuestionNumbers?: number[];
  blankQuestionNumbers?: number[];
};
export type NetResultRowOutcome = { studentId: string; subject: string; status: "success" | "failed"; error?: string };

// PDF'ten çıkarılan ya da elle girilen bir ızgaranın TAMAMINI tek seferde
// yazar — POST /api/exams/[id]/net-results (tek satır) ile AYNI upsert
// sözleşmesini (examId+studentId+subject benzersizliği, net hesaplaması
// ÇAĞIRANDA yapılır çünkü kaynağa göre değişir: PDF/elle giriş doğru/yanlış
// VEYA doğrudan net verebilir) tek transaction'da tekrarlar.
export async function bulkUpsertExamNetResults(input: {
  examId: string;
  institutionId: string;
  actorId: string;
  actorRole: string;
  source: "pdf-import" | "manual-grid";
  rows: NetResultRow[];
}): Promise<{ results: NetResultRowOutcome[]; successCount: number; failedCount: number }> {
  const studentIds = [...new Set(input.rows.map((r) => r.studentId))];
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, institutionId: input.institutionId },
    select: { id: true },
  });
  const validStudentIdSet = new Set(validStudents.map((s) => s.id));

  const results: NetResultRowOutcome[] = [];
  const writes: ReturnType<typeof prisma.examNetResult.upsert>[] = [];

  for (const row of input.rows) {
    const subject = row.subject.trim();
    if (!validStudentIdSet.has(row.studentId)) {
      results.push({ studentId: row.studentId, subject, status: "failed", error: "Öğrenci bulunamadı." });
      continue;
    }
    if (!subject) {
      results.push({ studentId: row.studentId, subject, status: "failed", error: "Ders adı zorunludur." });
      continue;
    }
    if (!Number.isFinite(row.net)) {
      results.push({ studentId: row.studentId, subject, status: "failed", error: "Geçersiz net değeri." });
      continue;
    }
    const wrongQuestionNumbers = row.wrongQuestionNumbers ?? [];
    const blankQuestionNumbers = row.blankQuestionNumbers ?? [];
    writes.push(
      prisma.examNetResult.upsert({
        where: { examId_studentId_subject: { examId: input.examId, studentId: row.studentId, subject } },
        update: { net: row.net, wrongQuestionNumbers, blankQuestionNumbers },
        create: { examId: input.examId, studentId: row.studentId, subject, net: row.net, wrongQuestionNumbers, blankQuestionNumbers },
      })
    );
    results.push({ studentId: row.studentId, subject, status: "success" });
  }

  if (writes.length > 0) await prisma.$transaction(writes);

  const successCount = results.filter((r) => r.status === "success").length;

  // Röntgen köprüsü — SADECE kazanım verisi verilmiş VE CURRICULUM_TREE'de
  // gerçek kırılımı olan (bugün: Matematik, Fizik) satırlar için; diğerleri
  // ucuz bir bellek-içi kontrolle atlanır (ekstra sorgu YOK). Sıralı
  // çalışır (Promise.all DEĞİL) — toplu içe aktarma nadir/düşük frekanslı
  // bir yönetici işlemi, bağlantı havuzuna gereksiz eşzamanlı baskı
  // yapmaya değmez.
  for (const row of input.rows) {
    const subject = row.subject.trim();
    if (!(subject in CURRICULUM_TREE)) continue;
    if (!row.wrongQuestionNumbers && !row.blankQuestionNumbers) continue;
    if (!validStudentIdSet.has(row.studentId)) continue;
    await syncExamResultToRoentgen(input.examId, row.studentId, subject).catch(() => {});
  }

  // Toplu işlem — öğrenci/ders başına ayrı kayıt yerine TEK denetim kaydı
  // (aynı gerekçe: bkz. lib/server/admin/bulk-import.ts).
  if (successCount > 0) {
    await recordAuditLog({
      institutionId: input.institutionId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "GRADE_ENTERED",
      targetType: "Exam",
      targetId: input.examId,
      metadata: { count: successCount, source: input.source },
    });
  }

  return { results, successCount, failedCount: results.length - successCount };
}
