import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/osym-reference-tables — kurumun girdiği ÖSYM referans
// tabloları (bkz. lib/server/exams/osym-reference.ts'teki gerekçe — bunlar
// kurumun KENDİ elindeki gerçek net→sıralama verisidir, biz uydurmuyoruz).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const tables = await prisma.osymReferenceTable.findMany({
      where: { institutionId: session.institutionId },
      include: { rows: { orderBy: { net: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ tables });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("osym_tables_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/osym-reference-tables — { name, puanTuru, rowsText }.
// rowsText: her satır "net;sıralama" ya da "net,sıralama" — admin bunu
// elindeki tablodan kopyala-yapıştır yapar, tek tek satır girmez.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const puanTuru = typeof body?.puanTuru === "string" ? body.puanTuru.trim() : "";
    const rowsText = typeof body?.rowsText === "string" ? body.rowsText : "";
    if (!name || !puanTuru) return NextResponse.json({ error: "name ve puanTuru zorunludur." }, { status: 400 });

    const rows: { net: number; ranking: number }[] = [];
    for (const line of rowsText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[;,\t]+/).map((p: string) => p.trim().replace(",", "."));
      if (parts.length < 2) continue;
      const net = Number(parts[0]);
      const ranking = Number(parts[1]);
      if (Number.isFinite(net) && Number.isFinite(ranking) && ranking > 0) rows.push({ net, ranking: Math.round(ranking) });
    }
    if (rows.length < 2) return NextResponse.json({ error: "En az iki geçerli satır gerekli (net;sıralama)." }, { status: 400 });

    const table = await prisma.osymReferenceTable.create({
      data: { institutionId: session.institutionId, name, puanTuru, rows: { createMany: { data: rows } } },
      include: { rows: { orderBy: { net: "desc" } } },
    });
    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Bu isimde bir tablo zaten var." }, { status: 409 });
    }
    logger.error("osym_table_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/osym-reference-tables", handleGet);
export const POST = withApiLogging("POST /api/osym-reference-tables", handlePost);
