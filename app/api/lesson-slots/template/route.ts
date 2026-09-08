import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { toCsv } from "@/lib/server/payments/csv";
import { SCHEDULE_DAYS } from "@/lib/server/schedule/bulk-schedule";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/lesson-slots/template — doldurulmaya hazır ders programı
// taslağı (CSV, Excel'de açılır).
//
// ⚠️ BOŞ bir şablon değil: kurumun GERÇEK şubeleri, öğretmenleri ve
// tanımlı saatleriyle önceden doldurulmuş satırlar üretir. Müdürün
// yapması gereken tek şey öğretmen adını yazmak/değiştirmek —
// şube/gün/saat adlarını elle yazmaya çalışıp yazım hatası yüzünden
// satır kaybetmesin.
//
// Şubeler × günler × saatler kombinasyonu büyük olabildiği için satır
// üretimi tanımlı saatlerle ve hafta içi günlerle sınırlıdır.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const [branches, teachers, slots] = await Promise.all([
      prisma.branch.findMany({
        where: { institutionId: session.institutionId },
        select: { name: true, grade: true },
        orderBy: [{ grade: "asc" }, { name: "asc" }],
      }),
      prisma.teacher.findMany({
        where: { institutionId: session.institutionId },
        select: { firstName: true, lastName: true, subject: true },
        orderBy: [{ firstName: "asc" }],
      }),
      prisma.scheduleSlotDefinition.findMany({
        where: { institutionId: session.institutionId },
        select: { label: true },
        orderBy: { label: "asc" },
      }),
    ]);

    if (branches.length === 0 || slots.length === 0) {
      return NextResponse.json(
        { error: "Şablon için en az bir şube ve bir ders saati tanımlı olmalı." },
        { status: 400 }
      );
    }

    // Hafta içi — Cumartesi/Pazar isteyen müdür satırı elle ekler.
    const days = SCHEDULE_DAYS.slice(0, 5);
    const rows: string[][] = [];
    for (const branch of branches) {
      for (const day of days) {
        for (const slot of slots) {
          // Öğretmen ve ders sütunları BOŞ bırakılır — doldurulacak
          // olan bunlar. Dolu gelseydi müdür yanlışlıkla olduğu gibi
          // içe aktarabilirdi.
          rows.push([branch.name, day, slot.label, "", ""]);
        }
      }
    }

    // Öğretmen adlarının doğru yazılabilmesi için listeyi dosyanın
    // sonuna referans olarak ekliyoruz: ayrı bir sayfa/dosya
    // aramasınlar.
    rows.push([], ["# ÖĞRETMEN LİSTESİ (Öğretmen sütununa bu adlardan birini yazın)"]);
    for (const t of teachers) rows.push([`${t.firstName} ${t.lastName}`, t.subject]);

    const csv = toCsv(["Şube", "Gün", "Saat", "Öğretmen", "Ders (boşsa branşı kullanılır)"], rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ders-programi-sablonu.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("schedule_template_failed", error);
  }
}

export const GET = withApiLogging("GET /api/lesson-slots/template", handleGet);
