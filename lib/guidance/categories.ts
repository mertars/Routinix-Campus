// REHBERLİK KATEGORİLERİ — tek doğru kaynak.
//
// ⚠️ NEDEN VAR (Mert'in ekranında bulundu, 2026-09-16): görüşme notu
// formu "Kariyer / Aile / Sağlık / Diğer" gibi seçenekler sunuyordu ama
// şemadaki enum (GuidanceCategory) yalnızca üç değer tanıyor. Rehber
// öğretmen "Kariyer" seçip Kaydet'e bastığında istek 400 dönüyor ve not
// KAYDEDİLMİYORDU — sadece "Akademik" çalışıyordu. Etiket haritaları üç
// ayrı bileşende kopyalandığı için de yanlış olan hepsinde yanlıştı.
//
// Yeni bir kategori gerekiyorsa önce prisma/schema.prisma > GuidanceCategory
// genişletilir (migration), sonra buraya bir satır eklenir.
import type { GuidanceCategory } from "@prisma/client";

export const GUIDANCE_CATEGORY_LABEL: Record<GuidanceCategory, string> = {
  ACADEMIC: "Akademik",
  PSYCHOLOGICAL: "Psikolojik",
  DISCIPLINARY: "Davranış",
};

export const GUIDANCE_CATEGORIES = Object.keys(GUIDANCE_CATEGORY_LABEL) as GuidanceCategory[];
