import { prisma } from "@/lib/server/prisma";
import type { ExamCategoryKind } from "@prisma/client";

// Platformun her kuruma bir kez kurduğu varsayılan deneme klasörleri
// (kullanıcı kararı: "kategorileri biz vereceğiz"). Kurum sonrasında
// bunları silebilir ya da yenisini ekleyebilir — bu liste sadece
// BAŞLANGIÇ durumudur, sabit bir kısıt değil.
//
// sortOrder aralıkları bilerek seyrek (10'ar): kurumun sonradan eklediği
// kategoriler araya girebilsin diye.
export const DEFAULT_CATEGORIES: { name: string; sortOrder: number; kind: ExamCategoryKind }[] = [
  { name: "TYT", sortOrder: 10, kind: "STANDARD" },
  { name: "AYT", sortOrder: 20, kind: "STANDARD" },
  // YKS tekil deneme tutmaz — TYT+AYT eşleşmelerini (ExamGroup) listeler.
  { name: "YKS", sortOrder: 30, kind: "YKS_PAIR" },
  { name: "LGS", sortOrder: 40, kind: "STANDARD" },
  { name: "5. Sınıf", sortOrder: 50, kind: "STANDARD" },
  { name: "6. Sınıf", sortOrder: 60, kind: "STANDARD" },
  { name: "7. Sınıf", sortOrder: 70, kind: "STANDARD" },
  { name: "8. Sınıf", sortOrder: 80, kind: "STANDARD" },
  { name: "9. Sınıf", sortOrder: 90, kind: "STANDARD" },
  { name: "10. Sınıf", sortOrder: 100, kind: "STANDARD" },
  { name: "11. Sınıf", sortOrder: 110, kind: "STANDARD" },
  { name: "12. Sınıf", sortOrder: 120, kind: "STANDARD" },
];

// Varsayılan seti SADECE bir kez kurar. Bayrak (InstitutionSettings.
// examCategoriesSeeded) olmadan, kurum tüm kategorileri BİLEREK silerse
// sistem onları her istekte geri yaratır ve silme işlemi hiç tutmazdı.
export async function ensureDefaultCategories(institutionId: string): Promise<void> {
  const settings = await prisma.institutionSettings.findUnique({
    where: { institutionId },
    select: { examCategoriesSeeded: true },
  });
  if (settings?.examCategoriesSeeded) return;

  await prisma.examCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ institutionId, ...c })),
    skipDuplicates: true,
  });
  await prisma.institutionSettings.upsert({
    where: { institutionId },
    update: { examCategoriesSeeded: true },
    create: { institutionId, examCategoriesSeeded: true },
  });
}
