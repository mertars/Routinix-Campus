// Deneme sonucu PDF'lerini genel amaçlı bir satır×sütun ızgarasına çevirir.
//
// lib/bulk-import/parse-pdf.ts'ten FARKLI: o dosya BİLİNEN bir başlık
// satırına (Ad Soyad, T.C. No vb.) çapalanır — burada öyle bir sabit nokta
// YOK (optik okuma firmaları arası, hatta aynı firmanın denemeler arası
// düzeni/renkleri değişiyor, kullanıcıyla netleşti). Bu yüzden sütun
// sınırları hiçbir başlığa güvenmeden, TÜM satırlardaki metnin yatayda
// hangi aralıkları kapladığına bakılarak (satırların çoğunda metin
// OLMAYAN dikey "boşluk koridorları" = sütun ayracı) istatistiksel olarak
// tespit edilir. Bu, kesin bir tablo ayrıştırıcı DEĞİLDİR — best-effort'tur;
// çağıran taraf (bkz. components/principal/tabs/exam-results-import/) bu
// çıktıyı HER ZAMAN düzenlenebilir bir önizlemede gösterip kaydetmeden önce
// düzeltme fırsatı vermelidir.
export type PdfGridResult = { grid: string[][]; warnings: string[] };

type TextItem = { x: number; xEnd: number; y: number; text: string };

const Y_TOLERANCE = 4; // pt — aynı satır sayılacak dikey yakınlık
const BIN_WIDTH = 1; // pt — yatay doluluk histogramının çözünürlüğü
// ⚠️ Gerçek bir optik okuma raporu örneğinde (kullanıcıdan alındı) her ders
// için D/Y/N üçlüsü YAN YANA, çok dar aralıklarla basılıyor — sentetik
// test PDF'imdeki (bilerek geniş CSS padding'li) sütunlardan çok daha sıkı.
// Eski 6pt eşiği bu tür dar sütunları TEK hücrede birleştirebilirdi. 3pt'e
// düşürüldü — kelime İÇİ karakter boşluklarını (genelde <1-2pt) hâlâ
// yanlışlıkla ayraç saymaz, ama gerçek dar sütun boşluklarını yakalar.
const MIN_GUTTER_WIDTH_PT = 3; // pt — bir boşluğun "sütun ayracı" sayılması için asgari genişlik
const OCCUPANCY_TOLERANCE_RATIO = 0.08; // satırların bu oranından azında metin varsa "boş" say
const MAX_BINS = 20000; // aşırı geniş/bozuk sayfalarda sonsuz döngü/performans koruması

function groupIntoLines(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine[0].y - item.y) <= Y_TOLERANCE) lastLine.push(item);
    else lines.push([item]);
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

// Başlık/dipnot gibi satırlar TABLONUN sütun yapısını PAYLAŞMAZ ama neredeyse
// tüm sayfa genişliğini kaplar — TÜM satırlar üzerinden ayraç ararsak bu
// tür satırlar, gerçek verinin sahip olduğu boşlukları da "dolu" göstererek
// ayraç tespitini komple bozar (canlı testte gözlemlendi: tek bir geniş
// başlık satırı yüzünden hiçbir veri sütunu ayrılamadı). ⚠️ Başlangıçta
// SADECE "az öğeli" satırlar (dipnot) dışlanıyordu ama gerçek testte başlık
// satırının veri satırlarından DAHA FAZLA öğeye sahip olduğu görüldü (her
// kelime harfler arası boşluklu ayrı bir öğe olarak geldi) — "az" filtresi
// onu YAKALAYAMADI. Bunun yerine en SIK görülen öğe sayısına (mod) YAKIN
// satırlar tablo sayılır; hem az hem çok öğeli aykırı satırlar (başlık VE
// dipnot) hariç tutulur.
function selectTabularLines(lines: TextItem[][]): TextItem[][] {
  if (lines.length < 3) return lines;
  const freq = new Map<number, number>();
  for (const line of lines) freq.set(line.length, (freq.get(line.length) ?? 0) + 1);
  let mode = lines[0].length;
  let modeFreq = 0;
  for (const [count, freqCount] of freq) {
    if (freqCount > modeFreq) {
      mode = count;
      modeFreq = freqCount;
    }
  }
  const tabular = lines.filter((l) => Math.abs(l.length - mode) <= 1);
  return tabular.length >= 2 ? tabular : lines;
}

// TÜM (tablo-benzeri) satırlardaki metin kapsamına bakıp, satırların büyük
// çoğunluğunda metin BULUNMAYAN yeterince geniş dikey koridorları "sütun
// ayracı" sayar ve sınır X konumlarını döner (N ayraç → N+1 sütun aralığı).
function detectColumnBoundaries(allLines: TextItem[][]): number[] {
  const lines = selectTabularLines(allLines);
  const allItems = lines.flat();
  if (allItems.length === 0) return [];

  const minX = Math.min(...allItems.map((i) => i.x));
  const maxX = Math.max(...allItems.map((i) => i.xEnd));
  const binCount = Math.min(MAX_BINS, Math.max(1, Math.ceil((maxX - minX) / BIN_WIDTH)));
  const occupancy = new Array(binCount).fill(0);

  for (const line of lines) {
    const rowBins = new Set<number>();
    for (const item of line) {
      const startBin = Math.floor((item.x - minX) / BIN_WIDTH);
      const endBin = Math.floor((item.xEnd - minX) / BIN_WIDTH);
      for (let b = Math.max(0, startBin); b <= Math.min(binCount - 1, endBin); b++) rowBins.add(b);
    }
    for (const b of rowBins) occupancy[b] += 1;
  }

  const occupancyThreshold = lines.length * OCCUPANCY_TOLERANCE_RATIO;
  const boundaries: number[] = [minX];
  let gutterStart: number | null = null;
  for (let b = 0; b < binCount; b++) {
    const binX = minX + b * BIN_WIDTH;
    const isGutter = occupancy[b] <= occupancyThreshold;
    if (isGutter && gutterStart === null) {
      gutterStart = binX;
    } else if (!isGutter && gutterStart !== null) {
      if (binX - gutterStart >= MIN_GUTTER_WIDTH_PT) boundaries.push((gutterStart + binX) / 2);
      gutterStart = null;
    }
  }
  boundaries.push(maxX + 1);
  return [...new Set(boundaries)].sort((a, b) => a - b);
}

function buildGrid(lines: TextItem[][], boundaries: number[]): string[][] {
  if (boundaries.length < 2) {
    // Sütun ayracı hiç tespit edilemedi (örn. tek sütunluk/serbest metin) —
    // her satırdaki tüm metni TEK sütuna yaz, admin gerekirse elle böler.
    return lines.map((line) => [line.map((i) => i.text).join(" ")]);
  }
  const columnCount = boundaries.length - 1;
  return lines.map((line) => {
    const row = new Array(columnCount).fill("");
    for (const item of line) {
      const center = (item.x + item.xEnd) / 2;
      let colIndex = columnCount - 1;
      for (let i = 0; i < columnCount; i++) {
        if (center >= boundaries[i] && center < boundaries[i + 1]) {
          colIndex = i;
          break;
        }
      }
      row[colIndex] = row[colIndex] ? `${row[colIndex]} ${item.text}` : item.text;
    }
    return row;
  });
}

export async function extractPdfGrid(file: File): Promise<PdfGridResult> {
  const pdfjsLib = await import("pdfjs-dist");
  // bkz. lib/bulk-import/parse-pdf.ts'teki aynı not — worker paketleme
  // dışında tutulur, public/pdf.worker.min.mjs'e işaret eder.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // ⚠️ Sayfalar AYRI AYRI satırlara gruplanır (her pdfjs sayfasının kendi
  // Y koordinat sistemi vardır — farklı sayfalardaki aynı görsel satırlar
  // ham Y değerine göre BİRBİRİNE ÇOK YAKIN çıkar, örn. her sayfada aynı
  // konumda tekrar eden bir başlık satırı gibi; ham item listesini
  // sayfalar arası birleştirip TEK seferde Y-gruplamak, farklı sayfalardaki
  // alakasız satırları yanlışlıkla TEK satırda birleştirirdi).
  const allLines: TextItem[][] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageItems: TextItem[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      pageItems.push({ x, xEnd: x + item.width, y: item.transform[5], text: item.str.trim() });
    }
    allLines.push(...groupIntoLines(pageItems));
  }

  if (allLines.length === 0) return { grid: [], warnings: ["PDF içinde okunabilir metin bulunamadı — taranmış (görüntü) bir PDF olabilir."] };

  const boundaries = detectColumnBoundaries(allLines);
  const grid = buildGrid(allLines, boundaries);

  const warnings: string[] = [];
  if (boundaries.length < 2) warnings.push("Sütun sınırları güvenilir şekilde tespit edilemedi — tüm metin tek sütuna alındı, elle bölmeniz gerekebilir.");
  if (boundaries.length - 1 > 25) warnings.push("Çok sayıda sütun tespit edildi — bazıları hatalı bölünmüş olabilir, önizlemeden kontrol edin.");

  return { grid, warnings };
}
