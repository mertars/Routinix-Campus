import fs from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import { prisma } from "@/lib/server/prisma";
import { buildReportCardAnalysis } from "./analyzer";
import { renderHtmlToPdf } from "./pdf-generator";

const INSTITUTION_NAME = "Arslan Dershaneleri";

let compiledTemplate: Handlebars.TemplateDelegate | null = null;

async function getTemplate(): Promise<Handlebars.TemplateDelegate> {
  if (compiledTemplate) return compiledTemplate;
  const templatePath = path.join(process.cwd(), "lib/server/report-card/template.hbs");
  const source = await fs.readFile(templatePath, "utf-8");
  compiledTemplate = Handlebars.compile(source);
  return compiledTemplate;
}

export async function generateReportCardPdf(studentId: string, periodLabel: string): Promise<Buffer> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      branch: true,
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

  const template = await getTemplate();
  const html = template({
    institutionName: INSTITUTION_NAME,
    studentName: `${student.firstName} ${student.lastName}`,
    branchName: student.branch.name,
    periodLabel,
    attendanceRate: analysis.attendanceRate,
    subjectCount: analysis.subjectSummaries.length,
    subjectSummaries: analysis.subjectSummaries.map((summary) => ({
      ...summary,
      isPositive: summary.delta >= 0,
      deltaLabel: `${summary.delta >= 0 ? "+" : ""}${summary.delta}`,
    })),
    guidanceNotes: analysis.guidanceNotes,
  });

  const pdfBuffer = await renderHtmlToPdf(html);

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
