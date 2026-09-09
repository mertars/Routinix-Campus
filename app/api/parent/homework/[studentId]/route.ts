import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// Kaç ödev dönülecek. Veli "son durumu" merak eder; üç yıllık ödev
// arşivi ne okunur ne de taşınmaya değer.
const LIMIT = 30;

// GET /api/parent/homework/[studentId]
//
// Veli, çocuğunun ödevlerini ve ONUN gönderim durumunu görür.
//
// ⚠️ Bu uç, mevcut /api/homework?branchId=... ucunun yerine geçmek için
// var: o uç şubedeki HER öğrencinin gönderim durumunu (studentId +
// status olarak) aynı kurumdaki her oturuma veriyor. Veli için doğru
// kapsam "sınıfın tamamı" değil, "benim çocuğum".
async function handleGet(_request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");
    await assertParentOwnsStudent(session.sub, params.studentId);

    const student = await prisma.student.findUnique({
      where: { id: params.studentId },
      select: { branchId: true },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const homeworks = await prisma.homework.findMany({
      where: { branchIds: { has: student.branchId } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        title: true,
        description: true,
        dueAt: true,
        createdAt: true,
        teacher: { select: { firstName: true, lastName: true, subject: true } },
        // SADECE bu öğrencinin gönderimi — sınıfın tamamı değil.
        submissions: { where: { studentId: params.studentId }, select: { status: true, updatedAt: true } },
      },
    });

    const rows = homeworks.map((h) => {
      const own = h.submissions[0] ?? null;
      return {
        id: h.id,
        title: h.title,
        description: h.description,
        dueAt: h.dueAt?.toISOString() ?? null,
        createdAt: h.createdAt.toISOString(),
        teacherName: `${h.teacher.firstName} ${h.teacher.lastName}`,
        subject: h.teacher.subject,
        // Kayıt hiç yoksa öğrenci ödeve dokunmamış demektir.
        status: own?.status ?? "NOT_DONE",
        updatedAt: own?.updatedAt.toISOString() ?? null,
      };
    });

    const done = rows.filter((r) => r.status === "DONE").length;
    const overdue = rows.filter(
      (r) => r.status !== "DONE" && r.dueAt !== null && new Date(r.dueAt) < new Date()
    ).length;

    return NextResponse.json({
      homeworks: rows,
      total: rows.length,
      done,
      overdue,
      // Oran, ödev yoksa "0%" değil "yok" olmalı — sıfır ödevi başarısızlık
      // gibi göstermek veliyi yanıltır.
      successRate: rows.length === 0 ? null : Math.round((done / rows.length) * 100),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("parent_homework_failed", error);
  }
}

export const GET = withApiLogging("GET /api/parent/homework/[studentId]", handleGet);
