import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging } from "@/lib/logger";
import { resolveContractToken } from "@/lib/server/contracts/contract-service";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// İmza görseli için üst sınır — tuval PNG'i normalde 10-40 KB olur; bu
// sınır kötü niyetli/bozuk bir isteğin DB'ye megabaytlarca veri yazmasını
// engeller.
const MAX_SIGNATURE_BYTES = 400_000;

// POST /api/contracts/shared/[token]/sign — { signerName, signerRelation,
// signatureData } — VELİ tarafı, oturum GEREKTİRMEZ (token yeterlidir).
async function handlePost(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const resolution = await resolveContractToken(params.token);
    if (!resolution.ok) return NextResponse.json({ error: "Sözleşme bulunamadı veya süresi dolmuş." }, { status: 404 });
    // Bir sözleşme YALNIZCA BİR KEZ imzalanır — imzalı bir metnin üzerine
    // yazılması, imzalanan içeriğin sonradan değiştirilebildiği anlamına
    // gelirdi.
    if (resolution.contract.status === "SIGNED") {
      return NextResponse.json({ error: "Bu sözleşme zaten imzalanmış." }, { status: 409 });
    }

    const body = await request.json().catch(() => null);
    const signerName = (body?.signerName as string | undefined)?.trim();
    const signerRelation = (body?.signerRelation as string | undefined)?.trim() || null;
    const signatureData = body?.signatureData as string | undefined;

    if (!signerName) return NextResponse.json({ error: "Ad soyad zorunludur." }, { status: 400 });
    if (!signatureData?.startsWith("data:image/png;base64,")) {
      return NextResponse.json({ error: "Geçerli bir imza görseli gerekli." }, { status: 400 });
    }
    if (signatureData.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json({ error: "İmza görseli çok büyük." }, { status: 413 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const signedIp = forwarded ? forwarded.split(",")[0].trim() : null;

    await prisma.studentContract.update({
      where: { id: resolution.contract.id },
      data: { status: "SIGNED", signerName, signerRelation, signatureData, signedAt: new Date(), signedIp },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure("shared_contract_sign_failed", error);
  }
}

export const POST = withApiLogging("POST /api/contracts/shared/[token]/sign", handlePost);
