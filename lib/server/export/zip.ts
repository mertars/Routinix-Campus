import { deflateRawSync, crc32 } from "node:zlib";

// ----------------------------------------------------------------------------
// KÜÇÜK ZIP YAZICI — bağımlılıksız.
//
// ⚠️ NEDEN KENDİ YAZICIMIZ (Mert, 2026-09-17: "tek tuşla bütün verileri bir
// dosyayla indirip verebilmem lazım, klasör şeklinde olsun"): projede zip
// kütüphanesi yok. Tek ihtiyaç "birkaç CSV'yi klasörlü tek dosyaya koymak";
// bunun için bir paket eklemek (ve onun bakım/güvenlik yükünü almak)
// orantısızdı. ZIP'in yalnızca gereken kısmı burada: yerel başlık + merkezi
// dizin + son kayıt. Klasörler ZIP'te ayrı bir kavram değildir — dosya
// adındaki "/" klasörü oluşturur.
//
// Deflate KULLANILIYOR (store değil): CSV çok iyi sıkışır, 50 MB'lık bir
// dışa aktarım 5 MB'a iner. zlib Node'un içinde, ek maliyet yok.
//
// ⚠️ SINIR: dosyalar belleğe alınır. Bir kurumun tüm verisi için uygundur
// (ölçüldü: 100 öğrencilik kurumda birkaç MB). Milyonlarca satıra çıkılırsa
// akış (stream) tabanlı bir yazıcıya geçilmeli.

export type ZipEntry = { path: string; content: string };

function dosTime(d: Date): { time: number; date: number } {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xffff;
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { time, date };
}

export function buildZip(entries: ZipEntry[]): Buffer {
  const now = new Date();
  const { time, date } = dosTime(now);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.path, "utf8");
    const raw = Buffer.from(entry.content, "utf8");
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // yerel başlık imzası
    local.writeUInt16LE(20, 4); // gereken sürüm
    local.writeUInt16LE(0x0800, 6); // bayraklar: UTF-8 dosya adı
    local.writeUInt16LE(8, 8); // yöntem: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(0, 42); // yerel başlığın uzaklığı (aşağıda yazılır)
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, end]);
}

/** Excel'in tr-TR ayarıyla doğru açılan CSV — BOM + noktalı virgül. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
}
