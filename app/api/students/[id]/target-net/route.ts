import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_NET = 200;

function parseNet(value: unknown): number | null | undefined {
  if (value === null) return null; // temizlemek isteyebilir
  if (value === undefined) return undefined; // gönderilmediyse dokunma
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0 || num > MAX_NET) return undefined;
  return Math.round(num * 100) / 100;
}

// PATCH /api/students/:id/target-net — öğrencinin KENDİ hedef netini
// girip güncelleyebildiği tek uç (bkz. Student.targetNet* — önceden
// yazma yolu yoktu). YKS şubesindeki öğrenci TYT/AYT'yi ayrı girer;
// diğer segmentler (LGS/MEZUN) tek bir toplam targetNet kullanır.
// SADECE öğrencinin kendisi yazabilir — danışman öğretmen/yönetici
// yazma yolu bu fazın kapsamı dışında bırakıldı.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    assertOwnsSelf(session, params.id);

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      select: { branch: { select: { segment: true } } },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const body = (await request.json()) as { targetNetTyt?: unknown; targetNetAyt?: unknown; targetNet?: unknown };
    const isYks = student.branch.segment === "YKS";

    if (isYks) {
      const tyt = parseNet(body.targetNetTyt);
      const ayt = parseNet(body.targetNetAyt);
      if (tyt === undefined && ayt === undefined) {
        return NextResponse.json({ error: "Geçerli bir TYT veya AYT hedef neti girin (0-200 arası)." }, { status: 400 });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.student.findUniqueOrThrow({ where: { id: params.id }, select: { targetNetTyt: true, targetNetAyt: true } });
        const nextTyt = tyt === undefined ? current.targetNetTyt : tyt;
        const nextAyt = ayt === undefined ? current.targetNetAyt : ayt;
        const combined = nextTyt === null && nextAyt === null ? null : (nextTyt ?? 0) + (nextAyt ?? 0);
        return tx.student.update({
          where: { id: params.id },
          data: { targetNetTyt: nextTyt, targetNetAyt: nextAyt, targetNet: combined },
          select: { targetNet: true, targetNetTyt: true, targetNetAyt: true },
        });
      });
      return NextResponse.json(updated);
    }

    const target = parseNet(body.targetNet);
    if (target === undefined) {
      return NextResponse.json({ error: "Geçerli bir hedef net girin (0-200 arası)." }, { status: 400 });
    }
    const updated = await prisma.student.update({
      where: { id: params.id },
      data: { targetNet: target },
      select: { targetNet: true, targetNetTyt: true, targetNetAyt: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("student_target_net_update_failed", { studentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/students/[id]/target-net", handlePatch);
