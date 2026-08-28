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
      track: input.track?.trim() || undefined,
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
