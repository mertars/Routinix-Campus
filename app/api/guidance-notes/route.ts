import { NextRequest, NextResponse } from "next/server";
import type { GuidanceCategory, ConfidentialityLevel } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/guidance-notes — bir öğretmen öğrenciyi rehberliğe sevk eder /
// bir görüşme notu ekler.
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, authorName, category, confidentialityLevel, note } = body as {
      studentId?: string;
      authorName?: string;
      category?: GuidanceCategory;
      confidentialityLevel?: ConfidentialityLevel;
      note?: string;
    };

    if (!studentId || !authorName?.trim() || !note?.trim()) {
      return NextResponse.json({ error: "studentId, authorName ve note zorunludur." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const guidanceNote = await prisma.guidanceNote.create({
      data: {
        studentId,
        authorName: authorName.trim(),
        category: category ?? "ACADEMIC",
        confidentialityLevel: confidentialityLevel ?? "RESTRICTED",
        note: note.trim(),
      },
    });

    return NextResponse.json({ guidanceNote }, { status: 201 });
  } catch (error) {
    logger.error("guidance_note_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// GET /api/guidance-notes?studentId=X  veya  ?feed=true&limit=N
// feed=true: yönetici canlı akışı — CONFIDENTIAL notlar burada ASLA görünmez.
async function handleGet(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId");
    const isFeed = request.nextUrl.searchParams.get("feed") === "true";

    if (isFeed) {
      const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? "4") || 4);
      const notes = await prisma.guidanceNote.findMany({
        where: { confidentialityLevel: { not: "CONFIDENTIAL" } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { student: { select: { firstName: true, lastName: true } } },
      });
      return NextResponse.json({
        notes: notes.map((n) => ({
          id: n.id,
          authorName: n.authorName,
          studentName: `${n.student.firstName} ${n.student.lastName}`,
          category: n.category,
          confidentialityLevel: n.confidentialityLevel,
          createdAt: n.createdAt.toISOString(),
        })),
      });
    }

    if (!studentId) {
      return NextResponse.json({ error: "studentId veya feed=true parametrelerinden biri zorunludur." }, { status: 400 });
    }
    const notes = await prisma.guidanceNote.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ notes });
  } catch (error) {
    logger.error("guidance_notes_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/guidance-notes", handlePost);
export const GET = withApiLogging("GET /api/guidance-notes", handleGet);
