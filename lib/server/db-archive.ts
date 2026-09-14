import { Prisma } from "@prisma/client";

// SİLİNEN SATIR ARŞİVİ (ÇÖP KUTUSU).
//
// ⚠️ NEDEN VAR: db-guard.ts "daraltılmamış" silmeyi engelliyor, ama DOĞRU
// biçimde yazılıp YANLIŞ id'lere denk gelen bir silme hâlâ mümkün. 2026-09-12
// ve 09-14'teki kayıplar geri getirilemedi; bu katmandan sonra hiçbir silme
// kalıcı değil — satırın tam kopyası silinmeden ÖNCE DeletedRowArchive'a yazılır.
//
// ⚠️ SINIRLARI (bilerek):
//   * Veritabanı seviyesindeki CASCADE silmeler Prisma'dan geçmez, buraya
//     DÜŞMEZ. Kurum/öğrenci gibi üst kayıt silmelerinde tek güvence yedektir
//     (scripts/backup-db.sh).
//   * Yalnızca PROTECTED_MODELS arşivlenir — log/oturum/tohum tablolarını
//     arşivlemek kutuyu çöpe çevirirdi.
//   * Maliyet: korunan modellerde silme başına bir ek SELECT + bir INSERT.
//     Silme bu tablolarda nadir bir işlem olduğu için kabul edilebilir.

/** Arşivlenecek modeller — db-guard'daki korunan liste ile aynı mantık. */
const ARCHIVED_MODELS = new Set([
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
  "GuidanceReferral",
  "AppointmentRequest",
  "ExamNetResult",
  "RemediationTask",
  "VideoAssignment",
  "TopicMasteryAssessment",
  "CurriculumProgress",
]);

// Silmeyi yapanı (varsa) bildirmek için — API rotaları oturumdan doldurur.
// AsyncLocalStorage kullanılmıyor: bu kod hem sunucuda hem script'lerde
// çalışıyor, basit bir modül değişkeni yeterli ve öngörülebilir.
let currentActor: string | null = null;
export function setArchiveActor(actor: string | null): void {
  currentActor = actor;
}

type AnyRow = Record<string, unknown>;

function institutionIdOf(row: AnyRow): string | null {
  const direct = row.institutionId;
  return typeof direct === "string" ? direct : null;
}

/**
 * Prisma eklentisi: korunan modellerde `delete` ve `deleteMany` çağrılarını
 * yakalar, silinecek satırları ÖNCE arşivler.
 *
 * ⚠️ prisma.$extends(bulkWriteGuard).$extends(deleteArchive) sırasıyla
 * bağlanır — guard önce çalışır (geniş sorgu zaten reddedilir), arşiv
 * yalnızca geçerli sorgularda devreye girer.
 */
export const deleteArchive = Prisma.defineExtension((client) =>
  client.$extends({
    name: "deleteArchive",
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          if (!ARCHIVED_MODELS.has(model)) return query(args);
          await archiveMatching(client, model, (args as { where?: unknown })?.where, "findMany");
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (!ARCHIVED_MODELS.has(model)) return query(args);
          await archiveMatching(client, model, (args as { where?: unknown })?.where, "findMany");
          return query(args);
        },
      },
    },
  })
);

async function archiveMatching(
  client: { [k: string]: unknown },
  model: string,
  where: unknown,
  finder: "findMany"
): Promise<void> {
  try {
    // Model adı "AttendanceRecord" → istemci alanı "attendanceRecord"
    const delegateKey = model.charAt(0).toLowerCase() + model.slice(1);
    const delegate = client[delegateKey] as
      | { [k: string]: (args: unknown) => Promise<AnyRow[]> }
      | undefined;
    if (!delegate || typeof delegate[finder] !== "function") return;

    const rows = await delegate[finder]({ where });
    if (!Array.isArray(rows) || rows.length === 0) return;

    const archive = client["deletedRowArchive"] as
      | { createMany: (args: unknown) => Promise<unknown> }
      | undefined;
    if (!archive) return;

    await archive.createMany({
      data: rows.map((row) => ({
        model,
        rowId: typeof row.id === "string" ? row.id : String(row.id ?? ""),
        institutionId: institutionIdOf(row),
        // Date/Decimal gibi tipler JSON'a çevrilirken kaybolmasın diye
        // Prisma'nın kendi serileştirmesine bırakılır.
        data: JSON.parse(JSON.stringify(row)),
        deletedBy: currentActor,
      })),
    });
  } catch {
    // ⚠️ Arşivleme başarısız olursa SİLME YİNE DE YAPILIR. Aksi hâli
    // (arşiv bozuksa silme de çalışmasın) uygulamayı kilitlerdi; burada
    // amaç güvenlik ağı olmak, tek hata noktası olmak değil.
  }
}
