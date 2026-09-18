import { resolveTrack, TRACK_LABEL, TRACK_START_GRADE } from "@/lib/tracks";
import { prisma } from "@/lib/server/prisma";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import type { BranchSegment } from "@prisma/client";

// Yeni bir kurum onboard edildiğinde 0 şubesi olur (bkz. scripts/onboard-institution.ts)
// — bu dosya öncesinde Şube (sınıf) oluşturmanın HİÇBİR yolu yoktu: sadece
// prisma/seed.ts demo verisinde sabit kodluydu. Toplu/tekli kullanıcı ekleme
// akışlarının (bkz. app/api/admin/import/bulk, app/api/admin/users/create)
// ikisi de var olan bir branchId'ye ihtiyaç duyduğundan, gerçek bir kurum için
// bu, ilk kullanıcıyı eklemeden önceki ZORUNLU ilk adımdır.
export async function createBranch(input: {
  institutionId: string;
  actorId: string;
  name: string;
  grade: number;
  segment: BranchSegment;
  track?: string;
}): Promise<{ id: string; name: string }> {
  const name = input.name?.trim();
  if (!name) throw new AdminCreateError("Şube adı zorunludur.");
  if (!Number.isInteger(input.grade) || input.grade < 5 || input.grade > 12) {
    throw new AdminCreateError("Sınıf seviyesi 5-12 arasında olmalıdır.");
  }

  // ⚠️ ALAN ZORUNLU — 11, 12 ve mezun şubelerinde (Mert, 2026-09-18).
  //
  // Kontrol SUNUCUDA da yapılır, yalnızca formda değil: istemciye asla
  // güvenilmez (bkz. CLAUDE.md > rol tabanlı yetkilendirme ilkesi) ve bu
  // uç toplu içe aktarma ile platform panelinden de çağrılıyor.
  //
  // Gerekçe: alan bilinmeden o sınıfın SORUMLU DERSLERİ hesaplanamıyor
  // (bkz. lib/tracks.ts) — ders programı, değerlendirme ve çalışma planı
  // hep eksik çıkıyordu. "Sonradan doldururuz" pratikte hiç doldurulmadı:
  // canlı veride şubelerin TAMAMI boştu.
  const needsTrack = input.segment === "MEZUN" || input.grade >= TRACK_START_GRADE;
  const resolvedTrack = resolveTrack(input.track ?? null, name);
  if (needsTrack && !resolvedTrack) {
    throw new AdminCreateError(
      "11, 12 ve mezun şubeleri için alan seçimi zorunludur (Sayısal / Eşit Ağırlık / Sözel / Yabancı Dil / Sadece TYT).",
      400
    );
  }

  const existing = await prisma.branch.findFirst({
    where: { institutionId: input.institutionId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) throw new AdminCreateError("Bu isimde bir şube zaten var.", 409);

  const branch = await prisma.branch.create({
    data: {
      institutionId: input.institutionId,
      name,
      grade: input.grade,
      segment: input.segment,
      // Alan KANONİK etiketiyle saklanır ("Sayısal", "Eşit Ağırlık"...) —
      // serbest metin olarak bırakılırsa aynı alan üç farklı yazımla
      // kaydedilir ve hiçbir hesap onu tanıyamaz.
      track: resolvedTrack ? TRACK_LABEL[resolvedTrack] : input.track?.trim() || undefined,
    },
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "BRANCH_CREATED",
    targetType: "Branch",
    targetId: branch.id,
    metadata: { name: branch.name, grade: branch.grade, segment: branch.segment },
  });

  return { id: branch.id, name: branch.name };
}

export async function listBranches(institutionId: string) {
  const branches = await prisma.branch.findMany({
    where: { institutionId },
    select: {
      id: true,
      name: true,
      grade: true,
      segment: true,
      track: true,
      _count: { select: { students: { where: { isActive: true } } } },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  return branches.map(({ _count, ...branch }) => ({ ...branch, studentCount: _count.students }));
}
