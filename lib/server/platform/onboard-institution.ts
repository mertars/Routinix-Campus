import { prisma } from "@/lib/server/prisma";
import { createAdminAccount, AdminCreateError } from "@/lib/server/admin/create-user";
import { createDefaultScheduleSlots } from "@/lib/server/admin/schedule-slots";

// scripts/onboard-institution.ts (terminal/CI erişimi olan biri için) VE
// app/api/platform/institutions (Süper Admin paneli üzerinden self-servis)
// AYNI mantığı paylaşır — iki farklı giriş noktasında iki farklı davranış
// riski olmasın.
export function slugify(input: string): string {
  return input
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function onboardInstitution(input: {
  name: string;
  slug?: string;
  actorId: string;
  adminName: string;
  adminTitle: string;
  adminPhone: string;
  adminEmail: string;
}) {
  const name = input.name?.trim();
  const slug = (input.slug?.trim() || (name ? slugify(name) : "")).trim();
  if (!name || !slug) throw new AdminCreateError("Kurum adı zorunludur.");
  if (!input.adminName?.trim() || !input.adminTitle?.trim() || !input.adminPhone?.trim() || !input.adminEmail?.trim()) {
    throw new AdminCreateError("Yöneticinin adı, unvanı, telefonu ve e-postası zorunludur.");
  }

  const existingSlug = await prisma.institution.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new AdminCreateError(`"${slug}" adında/kısa koduyla bir kurum zaten var. Farklı bir isim deneyin.`, 409);
  }

  const institution = await prisma.institution.create({ data: { name, slug, isActive: true } });
  await createDefaultScheduleSlots(institution.id);

  const admin = await createAdminAccount({
    institutionId: institution.id,
    actorId: input.actorId,
    fullName: input.adminName,
    title: input.adminTitle,
    mobilePhone: input.adminPhone,
    email: input.adminEmail,
    authorityLevel: "SUPER_ADMIN",
  });

  return { institution, admin };
}
