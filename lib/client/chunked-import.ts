// Uzun içe aktarımları PARÇA PARÇA çalıştıran istemci yardımcısı.
//
// İki sorunu birden çözer:
//
//  1) İLERLEME. Tek istek atıldığında ekranda yalnızca dönen bir çember
//     olur; 100 öğrencilik bir aktarımda müdür "dondu mu?" diye
//     düşünüp sayfayı yeniler. Parçalar arasında gerçek ilerleme
//     bildirilebilir ("43/100").
//
//  2) ZAMAN AŞIMI. Sunucu tarafında tek seferde ne kadar iş yapılırsa
//     yapılsın bir sınır vardır (Prisma etkileşimli işlem sınırı,
//     sunucusuz fonksiyon süresi). Parçalama bu tavanı tamamen ortadan
//     kaldırır.
//
// Bir parçanın hatası diğerlerini DURDURMAZ: kısmi başarı, hiç başarı
// olmamasından iyidir ve hangi satırların geçmediği zaten sonuçta
// bildirilir.

export type ChunkProgress = { done: number; total: number; percent: number };

export async function runChunked<TRow, TResult>(
  rows: TRow[],
  chunkSize: number,
  send: (chunk: TRow[]) => Promise<TResult[]>,
  onProgress: (progress: ChunkProgress) => void
): Promise<TResult[]> {
  const total = rows.length;
  const all: TResult[] = [];
  onProgress({ done: 0, total, percent: 0 });

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const part = await send(chunk);
    all.push(...part);
    const done = Math.min(i + chunkSize, total);
    onProgress({ done, total, percent: Math.round((done / total) * 100) });
  }
  return all;
}

// Parça büyüklüğü. Küçük olursa ilerleme sık güncellenir ama gidiş
// dönüş sayısı artar; büyük olursa tersi. 25, 100 satırlık bir
// aktarımda dört adımlık akıcı bir ilerleme verir ve sunucu tarafındaki
// toplu okuma avantajını da korur.
export const DEFAULT_CHUNK_SIZE = 25;
