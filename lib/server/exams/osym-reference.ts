import { prisma } from "@/lib/server/prisma";

// ÖSYM'nin GERÇEK ham puanı, o yılın TÜM Türkiye adaylarının ortalama/
// standart sapmasına göre hesaplanır — bu istatistik ÖSYM'nin kendi
// verisidir, elimizde YOK ve biz asla üretemeyiz. Bunu uydurmak (sahte
// bir katsayı tablosuyla "resmi puan" göstermek) yanıltıcı olurdu.
//
// Bunun yerine kurum, KENDİ elindeki gerçek referans veriyi (yayınevinden
// ya da ÖSYM'nin yıl sonu yayınladığı resmi istatistik raporundan aldığı
// net→sıralama tablosunu) buraya girer; karne bu tabloya göre ARA DEĞER
// (lineer interpolasyon) ile bir tahmin gösterir — açıkça "kurum kaynaklı
// tahmini sıralama" etiketiyle, asla "resmi ÖSYM sıralaması" olarak DEĞİL.
export async function estimateRanking(institutionId: string, puanTuru: string, net: number): Promise<{ tableName: string; estimatedRanking: number } | null> {
  const table = await prisma.osymReferenceTable.findFirst({
    where: { institutionId, puanTuru },
    include: { rows: { orderBy: { net: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  if (!table || table.rows.length === 0) return null;

  const rows = table.rows;
  // Net, tablodaki en yüksek nete eşit ya da üstündeyse en iyi sıra;
  // en düşük netin altındaysa en kötü sıra — aksi halde iki komşu satır
  // arasında lineer interpolasyon.
  if (net >= rows[0].net) return { tableName: table.name, estimatedRanking: rows[0].ranking };
  if (net <= rows[rows.length - 1].net) return { tableName: table.name, estimatedRanking: rows[rows.length - 1].ranking };

  for (let i = 0; i < rows.length - 1; i++) {
    const upper = rows[i];
    const lower = rows[i + 1];
    if (net <= upper.net && net >= lower.net) {
      const span = upper.net - lower.net;
      const ratio = span === 0 ? 0 : (upper.net - net) / span;
      const estimatedRanking = Math.round(upper.ranking + ratio * (lower.ranking - upper.ranking));
      return { tableName: table.name, estimatedRanking };
    }
  }
  return null;
}
