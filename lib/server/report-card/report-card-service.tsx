import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { buildReportCardAnalysis, generateXrayGuidanceNotes } from "./analyzer";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { PdfReportCard } from "@/components/pdf/pdf-report-card";

// Kampüs V2 Part 5 — bu fonksiyon eskiden Handlebars+Puppeteer (headless
// Chromium açıp HTML'i PDF'e "yazdırıyordu") kullanıyordu; bu yaklaşım
// tipik sunucusuz/PaaS barındırma ortamlarında ağır Chromium ikili dosyası
// yüzünden GÜVENİLİR ÇALIŞMIYORDU (görevin "çalışmayan PDF sistemi" tanımı
// tam olarak bu). Artık @react-pdf/renderer ile SAF JavaScript'te,
// tarayıcı/Chromium GEREKTİRMEDEN Buffer üretiliyor — çağıran taraflar
// (app/api/report-cards/[studentId]/route.ts, .../shared/[token]/route.ts)
// HİÇ değişmedi, imza (studentId, periodLabel) => Promise<Buffer> AYNI.
export async function generateReportCardPdf(studentId: string, periodLabel: string): Promise<Buffer> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      branch: true,
      institution: true,
      netResults: true,
      attendanceRecords: true,
    },
  });

  if (!student) throw new Error("Öğrenci bulunamadı.");

  const latestExamId = student.netResults.at(-1)?.examId;
  const latestNets = student.netResults.filter((result) => result.examId === latestExamId);

  const classAverages = await computeClassAverages(student.branchId, student.id, latestExamId, latestNets);

  const analysis = buildReportCardAnalysis(
    latestNets.map((result) => ({ subject: result.subject, net: result.net })),
    classAverages,
    student.attendanceRecords
  );

  // Danışman/branş öğretmeninin bu DÖNEM için yazdığı serbest metin yorum
  // (varsa) — analyzer.ts'teki kural-bazlı otomatik notlardan BİLEREK ayrı
  // bir bölüm olarak eklenir (bkz. ReportCardTeacherComment şemasındaki not).
  const teacherComment = await prisma.reportCardTeacherComment.findUnique({
    where: { studentId_periodLabel: { studentId, periodLabel } },
  });

  // Faz S — röntgen kırmızı bölgesi ("3 sistemi birbirine bağlama").
  // Röntgen verisi olmayan (henüz test edilmemiş/lise dışı) öğrenciler
  // için bu sorgu boş döner, karne davranışı DEĞİŞMEZ.
  const redZoneAssessments = await prisma.topicMasteryAssessment.findMany({
    where: { studentId, masteryScore: { lt: 30 } },
    select: { subject: true, subtopicId: true },
  });
  const redZoneSubtopics = redZoneAssessments.map((a) => {
    const topics = CURRICULUM_TREE[a.subject] ?? [];
    const name = topics.flatMap((t) => t.subtopics).find((s) => s.id === a.subtopicId)?.name ?? a.subtopicId;
    return { subject: a.subject, name };
  });
  const guidanceNotes = [...analysis.guidanceNotes, ...generateXrayGuidanceNotes(redZoneSubtopics)];

  const pdfBuffer = await renderToBuffer(
    <PdfReportCard
      institutionName={student.institution.name}
      logoUrl={student.institution.logoUrl}
      studentName={`${student.firstName} ${student.lastName}`}
      branchName={student.branch.name}
      periodLabel={periodLabel}
      attendanceRate={analysis.attendanceRate}
      subjectSummaries={analysis.subjectSummaries}
      guidanceNotes={guidanceNotes}
      teacherComment={teacherComment?.comment}
    />
  );

  await prisma.reportCard.create({ data: { studentId, periodLabel } });

  return pdfBuffer;
}

async function computeClassAverages(
  branchId: string,
  excludeStudentId: string,
  examId: string | undefined,
  studentNets: { subject: string; net: number }[]
): Promise<Record<string, number>> {
  if (!examId || studentNets.length === 0) return {};

  const classmates = await prisma.student.findMany({
    where: { branchId, id: { not: excludeStudentId } },
    include: { netResults: { where: { examId } } },
  });

  const classAverages: Record<string, number> = {};
  for (const entry of studentNets) {
    const peerNets = classmates.flatMap((classmate) => classmate.netResults.filter((result) => result.subject === entry.subject).map((r) => r.net));
    const all = [entry.net, ...peerNets];
    classAverages[entry.subject] = Math.round((all.reduce((sum, value) => sum + value, 0) / all.length) * 100) / 100;
  }
  return classAverages;
}
