import { prisma } from "@/lib/server/prisma";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { builtInsFor, type TemplateModule } from "@/lib/templates/catalog";

export type TemplateRow = {
  id: string;
  module: TemplateModule;
  name: string;
  description: string | null;
  payload: Record<string, unknown>;
  /** Hazır şablon mu — kurum bunu silemez, kopyalayabilir. */
  isBuiltIn: boolean;
  usageCount: number;
};

// Bir modülün TÜM şablonları: önce kurumun kendi yazdıkları (en çok
// kullanılan üstte), sonra hazır olanlar.
//
// Sıralama bilinçli: müdür kendi kurduğu düzeni hazır olandan daha çok
// kullanır; hazırlar başlangıç noktasıdır, varış değil.
export async function listTemplates(institutionId: string, module: TemplateModule): Promise<TemplateRow[]> {
  const custom = await prisma.template.findMany({
    where: { institutionId, module },
    orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }],
  });

  return [
    ...custom.map(
      (t): TemplateRow => ({
        id: t.id,
        module: t.module as TemplateModule,
        name: t.name,
        description: t.description,
        payload: (t.payload ?? {}) as Record<string, unknown>,
        isBuiltIn: false,
        usageCount: t.usageCount,
      })
    ),
    ...builtInsFor(module).map(
      (t): TemplateRow => ({
        id: t.id,
        module: t.module,
        name: t.name,
        description: t.description,
        payload: t.payload,
        isBuiltIn: true,
        usageCount: 0,
      })
    ),
  ];
}

export async function saveTemplate(input: {
  institutionId: string;
  module: TemplateModule;
  name: string;
  description?: string | null;
  payload: Record<string, unknown>;
  createdByAdminId: string;
}) {
  const name = input.name.trim();
  if (!name) throw new AdminCreateError("Şablon adı zorunludur.", 400);
  if (name.length > 80) throw new AdminCreateError("Şablon adı en fazla 80 karakter olabilir.", 400);
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new AdminCreateError("Şablon içeriği okunamadı.", 400);
  }

  // Aynı isim yeniden kaydedilirse ÜSTÜNE YAZILIR. Müdür için doğal
  // olan bu: "şablonu güncelledim" der, "eski adıyla çakıştı" hatası
  // beklemez. usageCount korunur (upsert update'inde yok).
  return prisma.template.upsert({
    where: { institutionId_module_name: { institutionId: input.institutionId, module: input.module, name } },
    create: {
      institutionId: input.institutionId,
      module: input.module,
      name,
      description: input.description?.trim() || null,
      payload: input.payload as never,
      createdByAdminId: input.createdByAdminId,
    },
    update: {
      description: input.description?.trim() || null,
      payload: input.payload as never,
    },
  });
}

export async function deleteTemplate(institutionId: string, id: string) {
  // Hazır şablonlar veritabanında değil — silinemezler.
  if (id.startsWith("hazir:")) {
    throw new AdminCreateError("Hazır şablonlar silinemez. Kendi şablonunuzu oluşturup onu kullanabilirsiniz.", 400);
  }
  const existing = await prisma.template.findUnique({ where: { id }, select: { institutionId: true } });
  if (!existing || existing.institutionId !== institutionId) {
    throw new AdminCreateError("Şablon bulunamadı.", 404);
  }
  await prisma.template.delete({ where: { id } });
}

// Şablon uygulandığında sayacı artırır — sık kullanılan üste çıksın.
// Hazır şablonlarda ve hatada SESSİZCE geçilir: bir sayaç yüzünden
// müdürün asıl işi (duyuruyu yayınlamak) engellenmemeli.
export async function markTemplateUsed(institutionId: string, id: string): Promise<void> {
  if (!id || id.startsWith("hazir:")) return;
  try {
    await prisma.template.updateMany({
      where: { id, institutionId },
      data: { usageCount: { increment: 1 } },
    });
  } catch {
    // yut
  }
}
