import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/exam-groups — YKS eşleşmeleri (TYT + AYT oturumları) ve
// eşleştirilmeye HAZIR denemeler. Bir YKS denemesi tek bir sınav değil,
// iki oturumdur; optik dosyaları ayrı geldiği için ayrı Exam kayıtları
// olarak durur, bu grup onları tek bir deneme gibi ele almayı sağlar.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const [groups, ungrouped] = await Promise.all([
      prisma.examGroup.findMany({
        where: { institutionId: session.institutionId },
        orderBy: { examDate: "desc" },
        include: {
          exams: {
            orderBy: { examDate: "asc" },
            select: { id: true, name: true, examDate: true, category: { select: { name: true } } },
          },
        },
      }),
      // Henüz bir gruba bağlı olmayan denemeler — eşleştirme seçicisini
      // besler. Kategori kısıtı YOK: kurum TYT/AYT dışında adlandırma
      // kullanıyor olabilir, seçimi kullanıcıya bırakmak daha güvenli.
      prisma.exam.findMany({
        where: { institutionId: session.institutionId, groupId: null },
        orderBy: { examDate: "desc" },
        take: 50,
        select: { id: true, name: true, examDate: true, category: { select: { name: true } } },
      }),
    ]);

    // Her grubun kaç öğrencisi var (iki oturumun BİRLEŞİMİ — aynı öğrenci
    // iki oturuma da girdiyse bir kez sayılır).
    const groupExamIds = groups.flatMap((g) => g.exams.map((e) => e.id));
    const resultRows =
      groupExamIds.length > 0
        ? await prisma.examNetResult.findMany({
            where: { examId: { in: groupExamIds } },
            select: { examId: true, studentId: true },
            distinct: ["examId", "studentId"],
          })
        : [];
    const examToGroup = new Map<string, string>();
    for (const g of groups) for (const e of g.exams) examToGroup.set(e.id, g.id);
    const studentsByGroup = new Map<string, Set<string>>();
    for (const r of resultRows) {
      const gid = examToGroup.get(r.examId);
      if (!gid) continue;
      const set = studentsByGroup.get(gid) ?? new Set<string>();
      set.add(r.studentId);
      studentsByGroup.set(gid, set);
    }

    return NextResponse.json({
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        examDate: g.examDate,
        studentCount: studentsByGroup.get(g.id)?.size ?? 0,
        exams: g.exams.map((e) => ({ id: e.id, name: e.name, examDate: e.examDate, categoryName: e.category?.name ?? null })),
      })),
      availableExams: ungrouped.map((e) => ({ id: e.id, name: e.name, examDate: e.examDate, categoryName: e.category?.name ?? null })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("exam_groups_list_failed", error);
  }
}

// POST /api/exam-groups — { name, examDate, examIds: [] }. En az iki
// oturum beklenir (TYT + AYT); tek oturumlu bir "eşleşme" anlamsız olur.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const examIds: string[] = Array.isArray(body?.examIds) ? body.examIds.filter((x: unknown) => typeof x === "string") : [];
    if (!name) return NextResponse.json({ error: "Deneme adı zorunludur." }, { status: 400 });
    if (examIds.length < 2) return NextResponse.json({ error: "Bir YKS denemesi için en az iki oturum (TYT ve AYT) seçmelisin." }, { status: 400 });

    const exams = await prisma.exam.findMany({ where: { id: { in: examIds } }, select: { id: true, institutionId: true, examDate: true } });
    if (exams.length !== examIds.length || exams.some((e) => e.institutionId !== session.institutionId)) {
      return NextResponse.json({ error: "Seçilen denemelerden biri bulunamadı." }, { status: 404 });
    }

    // Tarih verilmezse oturumların en ERKENİ kullanılır — YKS denemesi
    // genelde o hafta sonu başlar.
    const examDate = typeof body?.examDate === "string" && body.examDate ? new Date(body.examDate) : new Date(Math.min(...exams.map((e) => e.examDate.getTime())));

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.examGroup.create({ data: { institutionId: session.institutionId, name, examDate } });
      await tx.exam.updateMany({ where: { id: { in: examIds } }, data: { groupId: created.id } });
      return created;
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("exam_group_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/exam-groups", handleGet);
export const POST = withApiLogging("POST /api/exam-groups", handlePost);
