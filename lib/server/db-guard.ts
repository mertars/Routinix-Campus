import { Prisma } from "@prisma/client";

// TOPLU SİLME/GÜNCELLEME KORUMASI.
//
// ⚠️ NEDEN VAR: 2026-09-14'te bir test temizliği
// `attendanceRecord.deleteMany({ where: { date, slot } })` ile yazıldı.
// Niyet "az önce oluşturduğum 8 kaydı sil"di; sorgu 16 satır sildi, 8'i
// başkasına aitti. `date`/`slot` gibi alanlar "zaten benzersizdir" hissi
// verdiği için metin alanlarından bile tehlikeli.
//
// Alınan ders: kuralı hatırlamak yetmez, ORTAM izin vermemeli. Bu katman
// aşağıdaki modellerde `deleteMany`/`updateMany` çağrısını, sorgu bir
// SAHİPLİK/KİMLİK anahtarıyla daraltılmadıysa REDDEDER.
//
// Mevcut 13 deleteMany + 21 updateMany çağrısının tamamı bu kurala zaten
// uyuyor (hepsi studentId/examId/branchId/institutionId gibi bir anahtarla
// daraltılmış) — yani bu koruma çalışan hiçbir kodu kırmaz, sadece benim
// yaptığım türden sorguyu imkânsız kılar.

/** Bir satırı tek başına ya da net bir sahibine göre daraltan anahtarlar. */
const SCOPE_KEYS = new Set([
  "id",
  "institutionId",
  "studentId",
  "teacherId",
  // Rehberlik görüşmesi sahipliği (bkz. GuidanceMeeting) — öğretmen kimliği
  // ama ayrı alan adı; olmadan o modelde toplu silme hiç daraltılamıyordu.
  "counselorId",
  "parentId",
  "adminId",
  "branchId",
  "examId",
  "quizId",
  "homeworkId",
  "installmentId",
  "submissionId",
  "videoId",
  "formatId",
  "testId",
  "assignmentId",
  "announcementId",
  "appointmentId",
  "recipientId",
  "enrollmentId",
  "contractId",
  "paymentId",
  "batchId",
  "phone",
  "token",
]);

/**
 * Korunan modeller — bir kurumun GERÇEK işletme verisi. Referans/ayar
 * tabloları (ExamCategory, OpticalFormat vb.) bilerek dışarıda: onlar zaten
 * kuruma ait "kayıt" değil, yapılandırma.
 */
const PROTECTED_MODELS = new Set([
  "AttendanceRecord",
  "AttendanceSubmission",
  "Student",
  "Parent",
  "Teacher",
  "Admin",
  "Payment",
  "Installment",
  "StudentEnrollment",
  "StudentContract",
  "Homework",
  "HomeworkSubmission",
  "Question",
  "Quiz",
  "QuizSubmission",
  "QuizBankQuestion",
  "ClassbookNote",
  "YearlyPlanRow",
  "TeacherMaterial",
  "GuidanceNote",
  "GuidanceMeeting",
  "GuidanceReferral",
  "AppointmentRequest",
  "ExamNetResult",
  "RemediationTask",
  "ActivityNotification",
  "VideoAssignment",
  "TopicMasteryAssessment",
  "CurriculumProgress",
]);

function hasScopeKey(where: unknown, depth = 0): boolean {
  if (!where || typeof where !== "object" || depth > 4) return false;
  const obj = where as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (SCOPE_KEYS.has(key) && obj[key] !== undefined) return true;
    // AND/OR/NOT içindeki daraltmalar da sayılır.
    if (key === "AND" || key === "OR" || key === "NOT") {
      const nested = obj[key];
      const list = Array.isArray(nested) ? nested : [nested];
      // OR'da HER dal daraltılmış olmalı; biri daraltılmamışsa sorgu geniştir.
      if (key === "OR") {
        if (list.length > 0 && list.every((n) => hasScopeKey(n, depth + 1))) return true;
      } else if (list.some((n) => hasScopeKey(n, depth + 1))) {
        return true;
      }
    }
    // İlişki üzerinden daraltma: { student: { institutionId } } gibi.
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const inner = value as Record<string, unknown>;
      if ("is" in inner || "some" in inner || "every" in inner) {
        for (const v of Object.values(inner)) if (hasScopeKey(v, depth + 1)) return true;
      } else if (hasScopeKey(inner, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

export class UnscopedBulkWriteError extends Error {
  constructor(model: string, operation: string) {
    super(
      `GÜVENLİK: ${model}.${operation} bir sahiplik/kimlik anahtarı olmadan çağrıldı. ` +
        `Toplu yazma işlemleri id / institutionId / studentId gibi bir anahtarla DARALTILMALIDIR ` +
        `(bkz. lib/server/db-guard.ts — 2026-09-14'te (date, slot) ile yazılan bir temizlik ` +
        `başkasının 8 kaydını sildiği için eklendi).`
    );
    this.name = "UnscopedBulkWriteError";
  }
}

/**
 * Saf kontrol — eklentinin kalbi. Ayrı export edilmesinin sebebi test
 * edilebilirlik: veritabanına hiç bağlanmadan doğrulanabiliyor
 * (bkz. db-guard.test.ts).
 */
export function assertScopedBulkWrite(model: string, operation: "deleteMany" | "updateMany", where: unknown): void {
  if (PROTECTED_MODELS.has(model) && !hasScopeKey(where)) {
    throw new UnscopedBulkWriteError(model, operation);
  }
}

/**
 * Prisma Client eklentisi. `prisma.$extends(bulkWriteGuard)` ile bağlanır.
 * Sadece args'a bakar — ek sorgu YOK, ölçülebilir maliyeti yok.
 */
export const bulkWriteGuard = Prisma.defineExtension({
  name: "bulkWriteGuard",
  query: {
    $allModels: {
      async deleteMany({ model, args, query }) {
        assertScopedBulkWrite(model, "deleteMany", args?.where);
        return query(args);
      },
      async updateMany({ model, args, query }) {
        assertScopedBulkWrite(model, "updateMany", args?.where);
        return query(args);
      },
    },
  },
});
