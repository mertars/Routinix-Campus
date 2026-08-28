// Kroki verisi — serbest x/y konumlu "masa" (desk) listesi. Sabit satır/
// sütun ızgarası BİLEREK kullanılmadı: kullanıcı "her türlü fiziksel
// oturma düzeni" (U-düzeni dahil) istedi — U-düzeni bir ızgaraya sığmaz,
// ama x/y + mesafe-bazlı komşuluk (bkz. assign-seats.ts) her düzene uyar.
export type Desk = { id: string; x: number; y: number; seatCount: number };
export type ClassroomLayout = { desks: Desk[] };

export function isValidClassroomLayout(value: unknown): value is ClassroomLayout {
  if (!value || typeof value !== "object") return false;
  const desks = (value as { desks?: unknown }).desks;
  if (!Array.isArray(desks)) return false;
  return desks.every(
    (d) =>
      d &&
      typeof d === "object" &&
      typeof (d as Desk).id === "string" &&
      typeof (d as Desk).x === "number" &&
      typeof (d as Desk).y === "number" &&
      typeof (d as Desk).seatCount === "number" &&
      (d as Desk).seatCount >= 1 &&
      (d as Desk).seatCount <= 4
  );
}

const GAP_X = 220;
const GAP_Y = 140;

// Her çağrıda BENZERSİZ bir önek (Date.now()) kullanılır — editördeki
// şablon butonu (bkz. createTemplateLayout) mevcut krokiyi SIFIRLAYIP yeni
// masalar üretirken, eğer id'ler HER ZAMAN "desk-1".."desk-N" gibi
// deterministik olsaydı, yeni liste eski listeyle (aynı sayıda/az masa
// varsa) id ÇAKIŞIRDI — React bunu "aynı bileşen, sadece prop'ları
// değişti" sayıp KISMİ reconciliation yapardı. Kroki editöründeki her masa
// sürüklenebilir (framer-motion `drag`) bir motion.div olduğundan, bu
// kısmi reconciliation (bazı masalar aynı key ile kalıp bazıları
// kaldırılması) canlı testte gözlemlenen gerçek bir hataya yol açtı: üst
// Modal kapanırken AnimatePresence'ın çıkış izleme mantığı şaşırıp modal
// DOM'unu asla kaldırmıyordu (görünmez ama tıklamaları hâlâ yakalayan bir
// artık bırakıyordu). Benzersiz id'ler her şablon uygulamasında TAM bir
// unmount+mount garantiler, bu sorunu ortadan kaldırır.
function deskGrid(cols: number, rows: number, seatCount: number): Desk[] {
  const prefix = `desk-${Date.now()}`;
  const desks: Desk[] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      desks.push({ id: `${prefix}-${++i}`, x: c * GAP_X, y: r * GAP_Y, seatCount });
    }
  }
  return desks;
}

// Yeni açılan her sınıfın varsayılanı — kullanıcının isteği: "Standart
// 2'li Dizilim - Toplam 20 Sıra (10 Masa)".
export function createDefaultLayout(): ClassroomLayout {
  return { desks: deskGrid(2, 5, 2) };
}

export type LayoutTemplate = "2li" | "3lu" | "4lu" | "u";

// Kroki editöründeki hızlı-şablon butonları — mevcut düzeni SIFIRLAR
// (sonrası yine serbestçe sürüklenip özelleştirilebilir, bu sadece bir
// başlangıç noktası).
export function createTemplateLayout(template: LayoutTemplate): ClassroomLayout {
  if (template === "3lu") return { desks: deskGrid(2, 4, 3) }; // 2x4=8 masa x 3 = 24 koltuk
  if (template === "4lu") return { desks: deskGrid(2, 3, 4) }; // 2x3=6 masa x 4 = 24 koltuk
  if (template === "u") {
    // Benzersiz id öneki için bkz. deskGrid'teki not.
    const prefix = `desk-${Date.now()}`;
    const desks: Desk[] = [];
    let i = 0;
    const ROWS = 4;
    const COLS = 4;
    for (let r = 0; r < ROWS; r++) desks.push({ id: `${prefix}-${++i}`, x: 0, y: r * GAP_Y, seatCount: 2 }); // sol kenar
    for (let c = 1; c <= COLS; c++) desks.push({ id: `${prefix}-${++i}`, x: c * GAP_X, y: (ROWS - 1) * GAP_Y, seatCount: 2 }); // alt kenar
    for (let r = ROWS - 2; r >= 0; r--) desks.push({ id: `${prefix}-${++i}`, x: (COLS + 1) * GAP_X, y: r * GAP_Y, seatCount: 2 }); // sağ kenar
    return { desks };
  }
  return { desks: deskGrid(2, 5, 2) }; // "2li" varsayılan
}
