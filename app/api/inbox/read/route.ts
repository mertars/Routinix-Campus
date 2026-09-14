import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { ACTIVITY_CATEGORIES } from "@/lib/notifications/events";

export const dynamic = "force-dynamic";

// POST /api/inbox/read — okundu işaretleme.
//   { ids: [...] }        → yalnızca o bildirimler
//   { all: true }         → kutudaki her şey
//   { all: true, category } → yalnızca o sekme
//
// ⚠️ updateMany'nin where'i HER ZAMAN oturum sahibiyle sınırlı — istemci
// başkasının bildirim id'sini gönderse bile o satır eşleşmez (0 satır
// güncellenir), yani başkasının kutusuna dokunulamaz.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await request.json().catch(() => null)) as
      | { ids?: unknown; all?: unknown; category?: unknown }
      | null;

    const mine = { recipientRole: session.role, recipientId: session.sub, isRead: false };

    if (body?.all === true) {
      const categoryParam = typeof body.category === "string" ? body.category : null;
      const category =
        categoryParam && (ACTIVITY_CATEGORIES as readonly string[]).includes(categoryParam)
          ? (categoryParam as (typeof ACTIVITY_CATEGORIES)[number])
          : null;
      const result = await prisma.activityNotification.updateMany({
        where: { ...mine, ...(category ? { category } : {}) },
        data: { isRead: true, readAt: new Date() },
      });
      return NextResponse.json({ ok: true, updated: result.count });
    }

    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids veya all zorunludur." }, { status: 400 });
    }

    const result = await prisma.activityNotification.updateMany({
      where: { ...mine, id: { in: ids } },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("inbox_read_failed", error);
  }
}

export const POST = withApiLogging("POST /api/inbox/read", handlePost);
