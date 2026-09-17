import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { buildInstitutionExport } from "@/lib/server/export/institution-export";
import { buildZip } from "@/lib/server/export/zip";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";
// Büyük bir kurumun tüm verisi çekilip sıkıştırılacak — varsayılan süre yetmez.
export const maxDuration = 300;

// GET /api/platform/export?institutionId=... → kurumun TÜM verisi, klasörlü ZIP.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-17): "ben uygulamayı bıraksanız bile veri
// kaybınız yok, hepsini size veriyorum diye garanti vereceğim. Tek tuşla
// bütün verileri klasörlere bölünmüş bir dosyayla indirip verebilmem lazım."
//
// Bu bir SATIŞ VAADİNİN teknik karşılığı. Çıktı bilerek CSV: müşteri
// verisini bizim formatımıza bağımlı olmadan, Excel'de çift tıklayarak
// açabilmeli. "Verini istediğin an alırsın" ancak açılabilen bir dosyayla
// gerçek bir vaattir.
//
// 🔒 Yalnızca PLATFORM SAHİBİ. Kurum yöneticisine açılmadı: tek tuşla tüm
// kurum verisini indirebilmek, ele geçirilmiş bir yönetici hesabının en
// değerli hedefi olurdu. Mert dosyayı kendisi teslim edecek ("ben kendim
// veririm, sıkıntı yok").
async function handleGet(request: NextRequest) {
  try {
    const owner = await requirePlatformSession();
    const institutionId = request.nextUrl.searchParams.get("institutionId");
    if (!institutionId) throw new AuthError("Kurum seçilmedi.", "MISSING_FIELDS", 400);
    const institution = await requirePlatformInstitution(institutionId);

    const startedAt = Date.now();
    const entries = await buildInstitutionExport(institutionId, institution.name);
    const zip = buildZip(entries);

    // Denetim izi: tüm kurum verisinin dışarı çıkması sessiz olmamalı.
    logger.warn("institution_export_downloaded", {
      by: owner.sub,
      byName: owner.name,
      institutionId,
      institutionName: institution.name,
      files: entries.length,
      bytes: zip.length,
      durationMs: Date.now() - startedAt,
    });

    const safeName = institution.name.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+/g, "-").replace(/^-|-$/g, "");
    const stamp = new Date().toISOString().slice(0, 10);
    // Buffer → Uint8Array: NextResponse'un gövde tipi Buffer'ı kabul
    // etmiyor; aynı bellek, kopya yok.
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}-veri-yedegi-${stamp}.zip"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("institution_export_failed", error);
  }
}

export const GET = withApiLogging("GET /api/platform/export", handleGet);
