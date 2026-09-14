import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { ACTIVITY_CATEGORIES, type NotificationFeed } from "@/lib/notifications/events";

export const dynamic = "force-dynamic";

// GET /api/inbox — OTURUMDAKİ kişinin kendi bildirim kutusu.
//
// ⚠️ Adres BİLEREK /api/notifications DEĞİL: orası zaten DOLU ve BAŞKA bir
// sisteme ait (veliye giden toplu SMS partileri — NotificationBatch).
// Karışmasın diye bu uygulama içi kutu "inbox" adını aldı.
//
// Alıcı filtresi TAMAMEN oturumdan gelir (session.role + session.sub) —
// istemciden gelen hiçbir kimlik parametresi kabul edilmez, yani bir
// kullanıcı başkasının kutusunu isteyemez.
const PAGE_SIZE = 25;

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const categoryParam = request.nextUrl.searchParams.get("category");
    const cursor = request.nextUrl.searchParams.get("cursor");

    const category =
      categoryParam && (ACTIVITY_CATEGORIES as readonly string[]).includes(categoryParam)
        ? (categoryParam as (typeof ACTIVITY_CATEGORIES)[number])
        : null;

    const mine = { recipientRole: session.role, recipientId: session.sub };

    const rows = await prisma.activityNotification.findMany({
      where: { ...mine, ...(category ? { category } : {}) },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        category: true,
        eventType: true,
        title: true,
        body: true,
        href: true,
        actorName: true,
        urgent: true,
        isRead: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    // Sekme rozetleri — okunmamışlar kategori bazında tek sorguda sayılır.
    const grouped = await prisma.activityNotification.groupBy({
      by: ["category"],
      where: { ...mine, isRead: false },
      _count: { _all: true },
    });

    const unreadByCategory: Record<string, number> = {};
    let unreadTotal = 0;
    for (const g of grouped) {
      unreadByCategory[g.category] = g._count._all;
      unreadTotal += g._count._all;
    }

    const feed: NotificationFeed = {
      items: page.map((r) => ({
        id: r.id,
        category: r.category,
        eventType: r.eventType,
        title: r.title,
        body: r.body,
        href: r.href,
        actorName: r.actorName,
        urgent: r.urgent,
        isRead: r.isRead,
        createdAt: r.createdAt.toISOString(),
      })),
      unreadByCategory,
      unreadTotal,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };

    return NextResponse.json(feed);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("inbox_list_failed", error);
  }
}

export const GET = withApiLogging("GET /api/inbox", handleGet);
