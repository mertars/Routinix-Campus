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
// Tek transaction'da kaç satır yazılsın. 5 sn sınırının altında
// rahatça kalan, ama gidiş dönüş sayısını da makul tutan bir değer.

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
  // Optik okumadan gelen ham işaretli-şık dizisi (2026-09-06) — bkz. şema
  // notundaki gerekçe: "sisteme zaten girdi veriliyor, atmayalım". SADECE
  // optik yüklemeden gelir; elle girişte (manual-grid) verilmez.
  answerLetters?: string;
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
  source: "pdf-import" | "manual-grid" | "optical-import";
  rows: NetResultRow[];
}): Promise<{ results: NetResultRowOutcome[]; successCount: number; failedCount: number }> {
  const studentIds = [...new Set(input.rows.map((r) => r.studentId))];
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, institutionId: input.institutionId },
    select: { id: true },
  });
  const validStudentIdSet = new Set(validStudents.map((s) => s.id));

  const results: NetResultRowOutcome[] = [];

  // Yazılacak satırlar önce BELLEKTE toplanır; veritabanına satır satır
  // değil toplu gidilir (aşağıdaki gerekçeye bakın).
  type PendingWrite = {
    studentId: string;
    subject: string;
    net: number;
    wrongQuestionNumbers: number[];
    blankQuestionNumbers: number[];
    answerLetters: string | null;
  };
  const pending: PendingWrite[] = [];

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
    const answerLetters = row.answerLetters ?? null;
    pending.push({
      studentId: row.studentId,
      subject,
      net: row.net,
      wrongQuestionNumbers,
      blankQuestionNumbers,
      answerLetters,
    });
    results.push({ studentId: row.studentId, subject, status: "success" });
  }

  // ⚠️ SATIR SATIR upsert KULLANILMAZ.
  //
  // Tarihçe iki adımlı:
  //   1) Önce tüm satırlar TEK $transaction'a veriliyordu ve Prisma'nın
  //      5 sn sınırına takılıyordu; 400 satırlık gerçek bir denemede
  //      işlemin TAMAMI geri alınıyor, yönetici "Beklenmeyen hata"
  //      görüyordu (ölçüldü: 60 geçiyor, 120 geçmiyordu).
  //   2) 25'lik parçalara bölündü — zaman aşımı bitti ama her satır
  //      kendi gidiş dönüşünü yaptığı için YAVAŞ kaldı: 400 satır 50
  //      saniye. 500 öğrencilik bir kurumda (2000 satır) bu yeniden
  //      zaman aşımı demekti.
  //
  // Şimdi üç sorgu: mevcutları oku → sil → topluca yaz. Satır sayısından
  // bağımsız sabit sayıda gidiş dönüş.
  if (pending.length > 0) {
    // ⚠️ Silme aralığı DERS BAZINDA kurulur, öğrenci × ders ÇAPRAZ
    // ÇARPIMI olarak değil. Çapraz çarpım kullanılsaydı, yüklemede yer
    // ALMAYAN bir çift de silinirdi: yükleme (A, Matematik) ve
    // (B, Türkçe) içerirken çarpım (A, Türkçe)'yi de kapsar ve o satır
    // silinip yeniden yazılmaz — sessiz veri kaybı.
    const studentsBySubject = new Map<string, string[]>();
    for (const w of pending) {
      studentsBySubject.set(w.subject, [...(studentsBySubject.get(w.subject) ?? []), w.studentId]);
    }

    // answerLetters KORUNUR: bu alan yalnızca optik/PDF yüklemesinde
    // gelir. Elle net girişi yapan yönetici onu göndermez ve eski
    // upsert'te "verilmediyse dokunma" davranışı vardı — sil-yaz'a
    // geçerken bu kaybolmasın diye mevcut değer okunup taşınıyor.
    const existing = await prisma.examNetResult.findMany({
      where: {
        examId: input.examId,
        OR: [...studentsBySubject].map(([subject, ids]) => ({ subject, studentId: { in: ids } })),
      },
      select: { studentId: true, subject: true, answerLetters: true },
    });
    const previousLetters = new Map(existing.map((e) => [`${e.studentId}|${e.subject}`, e.answerLetters]));

    // Sil + yaz TEK işlemde: ikisinin arasında bir hata olursa öğrencinin
    // mevcut sonucu silinmiş, yenisi yazılmamış olurdu. İki toplu ifade
    // olduğu için 5 sn sınırına yaklaşmaz (eski hâlde satır başına bir
    // sorgu vardı, sorun oydu).
    await prisma.$transaction([
      prisma.examNetResult.deleteMany({
        where: {
          examId: input.examId,
          OR: [...studentsBySubject].map(([subject, ids]) => ({ subject, studentId: { in: ids } })),
        },
      }),
      prisma.examNetResult.createMany({
        data: pending.map((w) => ({
          examId: input.examId,
          studentId: w.studentId,
          subject: w.subject,
          net: w.net,
          wrongQuestionNumbers: w.wrongQuestionNumbers,
          blankQuestionNumbers: w.blankQuestionNumbers,
          answerLetters: w.answerLetters ?? previousLetters.get(`${w.studentId}|${w.subject}`) ?? null,
        })),
      }),
    ]);
  }

  const successCount = results.filter((r) => r.status === "success").length;

  // Röntgen köprüsü — SADECE kazanım verisi verilmiş VE CURRICULUM_TREE'de
  // gerçek kırılımı olan (bugün: Matematik, Fizik) satırlar için; diğerleri
  // ucuz bir bellek-içi kontrolle atlanır (ekstra sorgu YOK). Sıralı
  // çalışır (Promise.all DEĞİL) — toplu içe aktarma nadir/düşük frekanslı
  // bir yönetici işlemi, bağlantı havuzuna gereksiz eşzamanlı baskı
  // yapmaya değmez.
  const bridgeTargets: { studentId: string; subject: string }[] = [];
  for (const row of input.rows) {
    const subject = row.subject.trim();
    if (!(subject in CURRICULUM_TREE)) continue;
    // ⚠️ DİZİNİN VARLIĞI değil, İÇİNİN DOLU olması aranır.
    //
    // Burada eskiden `!row.wrongQuestionNumbers && !row.blankQuestionNumbers`
    // yazıyordu. JavaScript'te BOŞ DİZİ truthy olduğu için bu koşul hiç
    // tutmuyordu: düz net girişi (soru numarası olmadan) boş diziler
    // gönderdiğinde köprü YİNE çalışıyordu. Ölçüldü — 400 satırlık bir
    // yüklemede 200 gereksiz senkron, ~15 saniye: veritabanı işi toplam
    // 0,8 saniyeyken isteğin tamamı 16 saniye sürüyordu.
    const hasKazanimData =
      (row.wrongQuestionNumbers?.length ?? 0) > 0 || (row.blankQuestionNumbers?.length ?? 0) > 0;
    if (!hasKazanimData) continue;
    if (!validStudentIdSet.has(row.studentId)) continue;
    bridgeTargets.push({ studentId: row.studentId, subject });
  }

  // Köprü SINIRLI EŞZAMANLILIKLA çalışır.
  //
  // Tamamen sıralıydı; gerekçe "bağlantı havuzuna baskı yapmamak"tı ve
  // doğruydu, ama ölçüldü: gerçek kazanım verisiyle 100 satır 9 saniye
  // sürüyor — optik okuyucudan gelen 500 öğrencilik bir denemede ~45
  // saniye eder. Promise.all ile hepsini birden salmak da havuzu
  // tüketirdi; ikisinin arası olan sabit bir pencere kullanılıyor.
  const BRIDGE_CONCURRENCY = 5;
  for (let i = 0; i < bridgeTargets.length; i += BRIDGE_CONCURRENCY) {
    await Promise.all(
      bridgeTargets
        .slice(i, i + BRIDGE_CONCURRENCY)
        .map((t) => syncExamResultToRoentgen(input.examId, t.studentId, t.subject).catch(() => {}))
    );
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
