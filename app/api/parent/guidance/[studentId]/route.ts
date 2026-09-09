import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { PARENT_VISIBLE_CONFIDENTIALITY } from "@/lib/guidance/visibility";

export const dynamic = "force-dynamic";

const LIMIT = 30;

// GET /api/parent/guidance/[studentId]
//
// SADECE "Veliyle paylaşılabilir" (PUBLIC) rehberlik notları.
//
// Bu uç, tutulmayan bir vaadi kapatıyor: rehberlik notu yazarken
// gizlilik seviyesi seçilebiliyor ve seçeneklerden biri "Veliyle
// paylaşılabilir" diyor — ama sistemde bu notu veliye gösteren HİÇBİR
// yer yoktu. Müdür/rehber notu paylaşılabilir işaretliyor, veli asla
// görmüyordu.
//
// ⚠️ Süzgeç POZİTİF listedir (bkz. lib/guidance/visibility.ts). Kural
// oraya çıkarıldı ki test edilebilsin: şemaya yeni bir gizlilik
// seviyesi eklendiğinde test kırılır ve "bu veliye görünmeli mi?"
// sorusu yanıtlanmak zorunda kalır.
async function handleGet(_request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");
    await assertParentOwnsStudent(session.sub, params.studentId);

    const notes = await prisma.guidanceNote.findMany({
      where: { studentId: params.studentId, confidentialityLevel: { in: [...PARENT_VISIBLE_CONFIDENTIALITY] } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, category: true, note: true, authorName: true, createdAt: true },
    });

    return NextResponse.json({
      notes: notes.map((n) => ({
        id: n.id,
        category: n.category,
        note: n.note,
        authorName: n.authorName,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("parent_guidance_failed", error);
  }
}

export const GET = withApiLogging("GET /api/parent/guidance/[studentId]", handleGet);
