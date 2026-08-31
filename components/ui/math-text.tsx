"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Faz Z16 — kullanıcı geri bildirimi: AI soru üretim havuzundaki (bkz.
// lib/server/xray/question-generation/) matematik ifadeleri LaTeX olarak
// yazılıyor ama öğrenci ekranında HİÇ render edilmeden ("\sqrt{6} \cdot
// \sqrt{24}" gibi ham kod olarak) gösteriliyordu — projede daha önce HİÇ
// bir LaTeX render kütüphanesi yoktu. Üretim çıktısı da kendi içinde
// TUTARSIZ: bazen düzgün \(...\) ile sınırlandırılmış, bazen HİÇ sınır
// olmadan cümlenin ortasına "\sqrt{...}" gibi çıplak bir komut serpiştirilmiş
// (ör. "(-2)^3 ifadesinin değerini bulunuz" veya "\sqrt[3]{125} ifadesini
// üslü gösterimle yazınız"). Bu yüzden bu bileşen İKİ AŞAMALI çalışır:
// 1) Önce \(...\) / \[...\] ile AÇIKÇA sınırlandırılmış parçaları bulur.
// 2) Kalan düz metin içinde, bir "\komut" ile BAŞLAYIP bitişik matematiksel
//    token'larla (rakam, işlem, {..}/[..] grupları, ^/_ üs-altsimge) devam
//    eden "çıplak" LaTeX çalıştırmalarını TARAR ve onları da render eder.
// Amaç %100 mükemmel bir LaTeX ayrıştırıcısı değil — üretimde GERÇEKTEN
// görülen kalıpları güvenle yakalayıp, emin olmadığı yerde (ör. tek başına
// "^3" gibi öncesinde komut olmayan üsler) düz metne DOKUNMAMAK, yanlışlıkla
// Türkçe cümleyi bozmaktansa.

type Segment = { type: "text" | "math"; content: string; displayMode?: boolean };

function isBraceOpen(ch: string): boolean {
  return ch === "{" || ch === "[";
}

// Verilen indeksteki { veya [ ile başlayan grubun (iç içe geçmeler dahil)
// bittiği indeksi (kapanıştan SONRAKİ konum) döner.
function consumeBraceGroup(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let i = start;
  do {
    if (text[i] === open) depth++;
    else if (text[i] === close) depth--;
    i++;
  } while (i < text.length && depth > 0);
  return i;
}

// i konumundan başlayarak, bitişik matematiksel token'larla (komut, üs/alt
// simge, rakam, işlem, parantez, ARADAN BAŞKA BİR MATEMATİK TOKEN'I
// GELİYORSA boşluk) devam eden çalıştırmanın bittiği indeksi döner. i
// konumunda MUTLAKA "\harf" ile başlayan bir komut olmalı (çağıran garanti
// eder) — böylece "3 kalem" gibi düz metin YANLIŞLIKLA yakalanmaz.
function consumeBareMathRun(text: string, start: number): number {
  let i = start;
  while (i < text.length) {
    if (text[i] === "\\" && /[a-zA-Z]/.test(text[i + 1] ?? "")) {
      i++;
      while (i < text.length && /[a-zA-Z]/.test(text[i])) i++;
      while (i < text.length && isBraceOpen(text[i])) i = consumeBraceGroup(text, i);
      continue;
    }
    if (text[i] === "^" || text[i] === "_") {
      i++;
      if (text[i] === "{") {
        i = consumeBraceGroup(text, i);
      } else if (i < text.length) {
        i++;
      }
      continue;
    }
    if (/[0-9+\-*/=().,]/.test(text[i])) {
      i++;
      continue;
    }
    if (text[i] === " ") {
      let j = i;
      while (text[j] === " ") j++;
      if (text[j] === "\\" || text[j] === "^" || text[j] === "_" || /[0-9(]/.test(text[j] ?? "")) {
        i = j;
        continue;
      }
      break;
    }
    break;
  }
  return i;
}

// i konumundan GERİYE doğru, bir üs/altsimgenin "tabanını" (27^{...}'daki
// "27", (x+1)^{...}'daki "(x+1)", x^{...}'daki "x" gibi) bulur — sadece
// "^{"/"_{" görüldüğünde (bariz LaTeX, düz metinde neredeyse hiç geçmeyen
// bir kalıp) tetiklenir, bu yüzden Türkçe cümleleri yanlışlıkla yakalama
// riski düşük. Geriye taranabilir taban YOKSA (ör. cümle "^{" ile
// başlıyorsa) i'yi OLDUĞU GİBİ döner (run boş tabanla başlar).
function backtrackSuperscriptBase(text: string, i: number): number {
  if (i === 0) return i;
  const prev = text[i - 1];
  if (/[0-9]/.test(prev)) {
    let j = i;
    while (j > 0 && /[0-9]/.test(text[j - 1])) j--;
    return j;
  }
  if (prev === ")") {
    let depth = 0;
    let j = i;
    do {
      j--;
      if (text[j] === ")") depth++;
      else if (text[j] === "(") depth--;
    } while (j > 0 && depth > 0);
    return j;
  }
  if (/[a-zA-Z]/.test(prev)) return i - 1;
  return i;
}

function splitBareMathRuns(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let i = 0;
  while (i < text.length) {
    const isCommandStart = text[i] === "\\" && /[a-zA-Z]/.test(text[i + 1] ?? "");
    const isBareSuperscriptStart = (text[i] === "^" || text[i] === "_") && text[i + 1] === "{";
    if (isCommandStart || isBareSuperscriptStart) {
      const runStart = isBareSuperscriptStart ? backtrackSuperscriptBase(text, i) : i;
      const end = consumeBareMathRun(text, runStart);
      const mathContent = text.slice(runStart, end).trim();
      if (mathContent.length > 0 && end > runStart) {
        if (runStart > cursor) segments.push({ type: "text", content: text.slice(cursor, runStart) });
        segments.push({ type: "math", content: mathContent });
        cursor = end;
        i = end;
        continue;
      }
    }
    i++;
  }
  if (cursor < text.length) segments.push({ type: "text", content: text.slice(cursor) });
  return segments;
}

const DELIMITED_PATTERN = /\\\((.+?)\\\)|\\\[(.+?)\\\]/g;

function parseMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  DELIMITED_PATTERN.lastIndex = 0;
  while ((match = DELIMITED_PATTERN.exec(text))) {
    if (match.index > lastIndex) segments.push(...splitBareMathRuns(text.slice(lastIndex, match.index)));
    if (match[1] !== undefined) segments.push({ type: "math", content: match[1] });
    else if (match[2] !== undefined) segments.push({ type: "math", content: match[2], displayMode: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push(...splitBareMathRuns(text.slice(lastIndex)));
  return segments;
}

function MathSpan({ tex, displayMode }: { tex: string; displayMode?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: !!displayMode, strict: false });
    } catch {
      return null;
    }
  }, [tex, displayMode]);
  if (html === null) return <span>{tex}</span>;
  // eslint-disable-next-line react/no-danger -- KaTeX kendi ürettiği HTML'i döndürür, kullanıcı girdisi değil (üretim pipeline'ından gelir).
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Bir soru/cevap/çözüm metnini, içindeki LaTeX parçalarını KaTeX ile
// render ederek, düz metin kısımlarını OLDUĞU GİBİ göstererek çizer.
export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => parseMathSegments(text), [text]);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === "text" ? <span key={i}>{seg.content}</span> : <MathSpan key={i} tex={seg.content} displayMode={seg.displayMode} />,
      )}
    </span>
  );
}
