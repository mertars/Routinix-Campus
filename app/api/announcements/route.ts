import { NextRequest, NextResponse } from "next/server";
import type { AnnouncementCategory, AnnouncementAuthorRole, NotificationScopeType } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/announcements — yönetici (veya öğretmen) duyuru/etkinlik/acil
// bildirim yayınlar. scopeType: ALL_SCHOOL | GRADE (scopeValue: "12") |
// BRANCH (scopeValue: branchId).
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, category, scopeType, scopeValue, authorName, authorRole } = body as {
      title?: string;
      content?: string;
      category?: AnnouncementCategory;
      scopeType?: NotificationScopeType;
      scopeValue?: string;
      authorName?: string;
      authorRole?: AnnouncementAuthorRole;
    };

    if (!title?.trim() || !content?.trim() || !authorName?.trim() || !authorRole) {
      return NextResponse.json({ error: "title, content, authorName ve authorRole zorunludur." }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category: category ?? "GENERAL",
        scopeType: scopeType ?? "ALL_SCHOOL",
        scopeValue: scopeValue || null,
        authorName: authorName.trim(),
        authorRole,
      },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    logger.error("announcement_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// GET /api/announcements — yönetici yönetim görünümü (tümü).
// GET /api/announcements?studentId=X — öğrencinin şube/kademesine uygulanan
// duyurular, her biri için isRead bilgisiyle birlikte.
async function handleGet(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId");

    if (!studentId) {
      const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
      return NextResponse.json({ announcements });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { branch: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const all = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      include: { reads: { where: { studentId }, select: { id: true } } },
    });

    const applicable = all.filter((item) => {
      if (item.scopeType === "ALL_SCHOOL") return true;
      if (item.scopeType === "GRADE") return String(student.branch.grade) === item.scopeValue;
      if (item.scopeType === "BRANCH") return student.branchId === item.scopeValue;
      return false;
    });

    return NextResponse.json({
      announcements: applicable.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category,
        authorName: item.authorName,
        authorRole: item.authorRole,
        createdAt: item.createdAt.toISOString(),
        isRead: item.reads.length > 0,
      })),
    });
  } catch (error) {
    logger.error("announcements_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/announcements", handlePost);
export const GET = withApiLogging("GET /api/announcements", handleGet);
