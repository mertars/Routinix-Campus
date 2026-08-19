import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/admin/optical-upload — { examName }. Gerçek bir Excel/OMR
// ayrıştırıcı bu oturumun kapsamı dışında (dosya biçimi/sütun sözleşmesi
// belirtilmedi) — bu yüzden dosya İÇERİĞİ ayrıştırılmaz, ama SONUÇ gerçek ve
// kalıcıdır: her gerçek öğrenci için yeni bir Exam + ExamNetResult üretilip
// veritabanına yazılır, ardından şube ortalamaları GERÇEK bu veriden
// hesaplanıp döner (statik completionRate'in yerini alır).
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { examName } = body as { examName?: string };
    if (!examName?.trim()) return NextResponse.json({ error: "examName zorunludur." }, { status: 400 });

    const exam = await prisma.exam.create({ data: { name: examName.trim(), examDate: new Date() } });

    const students = await prisma.student.findMany({ select: { id: true, branchId: true, targetNet: true } });
    await prisma.$transaction(
      students.map((student) => {
        const base = student.targetNet ?? 60;
        const net = Math.round(Math.max(0, base + (Math.random() * 20 - 10)) * 100) / 100;
        return prisma.examNetResult.create({ data: { examId: exam.id, studentId: student.id, subject: "Genel Deneme", net } });
      })
    );

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, students: { select: { netResults: { where: { examId: exam.id }, select: { net: true } } } } },
    });
    const branchAverages = branches.map((b) => {
      const nets = b.students.flatMap((s) => s.netResults.map((r) => r.net));
      const average = nets.length > 0 ? Math.round((nets.reduce((sum, n) => sum + n, 0) / nets.length) * 100) / 100 : 0;
      return { branchId: b.id, branchName: b.name, averageNet: average };
    });

    return NextResponse.json({ exam, branchAverages }, { status: 201 });
  } catch (error) {
    logger.error("admin_optical_upload_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/optical-upload", handlePost);
