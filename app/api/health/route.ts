import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/health — Postgres bağlantısını doğrulamak için hızlı bir uçtan
// uca kontrol. `docker compose up -d` + `npm run db:push` sonrası
// çalıştırıp gerçek bağlantının kurulduğunu teyit edin.
async function handleGet() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", database: "disconnected", detail: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 503 }
    );
  }
}

export const GET = withApiLogging("GET /api/health", handleGet);
