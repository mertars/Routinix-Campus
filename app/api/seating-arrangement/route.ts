import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/seating-arrangement?branchId=X — roster gerçek Student tablosundan
// gelir; burada sadece o şube için mevcut koltuk SIRASI (varsa) döner. Kayıt
// yoksa roster'ın doğal (isim) sırası kullanılır.
async function handleGet(request: NextRequest) {
  try {
    const branchId = request.nextUrl.searchParams.get("branchId");
    if (!branchId) return NextResponse.json({ error: "branchId parametresi zorunludur." }, { status: 400 });

    const [students, arrangement] = await Promise.all([
      prisma.student.findMany({ where: { branchId }, select: { id: true, firstName: true, lastName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
      prisma.seatingArrangement.findUnique({ where: { branchId } }),
    ]);

    const byId = new Map(students.map((s) => [s.id, { id: s.id, name: `${s.firstName} ${s.lastName}` }]));
    const order = arrangement?.studentOrder.filter((id) => byId.has(id)) ?? [];
    const missing = students.map((s) => s.id).filter((id) => !order.includes(id));
    const seats = [...order, ...missing].map((id) => byId.get(id)!);

    return NextResponse.json({ seats });
  } catch (error) {
    logger.error("seating_arrangement_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/seating-arrangement — { branchId, studentOrder: string[] } koltuk
// sırasını kalıcı olarak kaydeder (yer değiştirme / çark sonucu).
async function handlePut(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, studentOrder } = body as { branchId?: string; studentOrder?: string[] };
    if (!branchId || !Array.isArray(studentOrder)) {
      return NextResponse.json({ error: "branchId ve studentOrder (dizi) zorunludur." }, { status: 400 });
    }
    await prisma.seatingArrangement.upsert({
      where: { branchId },
      update: { studentOrder },
      create: { branchId, studentOrder },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("seating_arrangement_put_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/seating-arrangement", handleGet);
export const PUT = withApiLogging("PUT /api/seating-arrangement", handlePut);
