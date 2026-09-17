import { prisma } from "@/lib/server/prisma";
import { ATTENDANCE_LABEL } from "@/lib/attendance/status";

// ----------------------------------------------------------------------------
// YÖNETİCİ EYLEMİNİ İNSAN DİLİNE ÇEVİRME.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-17): "daha detaylı istiyorum, mesela
// 'yönetici X hocanın Y tarihindeki şu yoklamasını aldı', 'Y öğrencisine
// şu ödevi verdi' gibi." Ham "POST /api/attendance" satırı bir şikâyette
// hiçbir şey anlatmaz.
//
// ⚠️ KAYNAK KAYDI DESENİ (bkz. CLAUDE.md > "source registry"): her uç için
// if/else dallanması yerine kendi kendini tanımlayan bir dizi girdisi.
// Yeni bir uç anlamlandırmak isteniyorsa buraya BİR SATIR eklenir; hiçbir
// yerde dallanma büyümez. Eşleşme bulunamazsa genel bir cümle üretilir —
// yani kayıt hiçbir zaman boş kalmaz.
//
// ⚠️ İSİMLER KAYIT ANINDA ÇÖZÜLÜR, rapor anında DEĞİL: altı ay sonra o
// şube silinmiş olabilir. Kanıt, oluştuğu anda dondurulmalıdır.
//
// ⚠️ GİZLİLİK: not/mesaj METİNLERİ buraya YAZILMAZ. Rehberlik notunun
// içeriği gizlilik seviyesine tabidir (bkz. lib/guidance/visibility.ts);
// raporda "not eklendi (kurum içi)" yazar, notun kendisi yazmaz.
// ----------------------------------------------------------------------------

export type Described = { summary: string; category: string; details: Record<string, unknown> };

type Ctx = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  /** Adres içindeki kimlik (örn. /api/homework/abc → "abc"). */
  lastSegment: string;
};

type Describer = {
  category: string;
  match: (ctx: Ctx) => boolean;
  build: (ctx: Ctx) => Promise<Described | null>;
};

const trDate = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

async function branchName(id: unknown): Promise<string> {
  if (typeof id !== "string" || !id) return "";
  const b = await prisma.branch.findUnique({ where: { id }, select: { name: true } });
  return b?.name ?? "silinmiş şube";
}

async function studentName(id: unknown): Promise<string> {
  if (typeof id !== "string" || !id) return "";
  const s = await prisma.student.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  return s ? `${s.firstName} ${s.lastName}` : "silinmiş öğrenci";
}

async function teacherName(id: unknown): Promise<string> {
  if (typeof id !== "string" || !id) return "";
  const t = await prisma.teacher.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
  return t ? `${t.firstName} ${t.lastName}` : "silinmiş öğretmen";
}

const DESCRIBERS: Describer[] = [
  // --- YOKLAMA ---
  {
    category: "Yoklama",
    match: (c) => c.path === "/api/attendance" && c.method === "POST",
    build: async (c) => {
      const b = c.body ?? {};
      const records = Array.isArray(b.records) ? (b.records as { studentId: string; status: string }[]) : [];
      const name = await branchName(b.branchId);
      const counts: Record<string, number> = {};
      for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;
      const breakdown = Object.entries(counts)
        .map(([st, n]) => `${n} ${(ATTENDANCE_LABEL as Record<string, string>)[st] ?? st}`)
        .join(", ");
      // Devamsız öğrencilerin adları — şikâyetin çoğu zaman tam konusu.
      const absentIds = records.filter((r) => r.status === "ABSENT").map((r) => r.studentId).slice(0, 25);
      const absentNames = await Promise.all(absentIds.map((id) => studentName(id)));
      return {
        category: "Yoklama",
        summary: `${name} şubesinin ${trDate(b.date)} ${String(b.slot ?? "")} yoklamasını aldı — ${records.length} öğrenci (${breakdown})`,
        details: { branchId: b.branchId, branchName: name, date: b.date, slot: b.slot, total: records.length, counts, absentNames },
      };
    },
  },
  // --- ÖDEV ---
  {
    category: "Ödev",
    match: (c) => c.path === "/api/homework" && c.method === "POST",
    build: async (c) => {
      const b = c.body ?? {};
      const ids = Array.isArray(b.branchIds) ? (b.branchIds as string[]) : [];
      const names = await Promise.all(ids.map((id) => branchName(id)));
      return {
        category: "Ödev",
        summary: `${names.join(", ") || "şube"} şubesine "${String(b.title ?? "")}" ödevini verdi${b.dueAt ? ` (son teslim ${trDate(b.dueAt)})` : ""}`,
        details: { title: b.title, branchNames: names, dueAt: b.dueAt, targetQuestionCount: b.targetQuestionCount },
      };
    },
  },
  {
    category: "Ödev",
    match: (c) => c.path.startsWith("/api/homework/") && (c.method === "PATCH" || c.method === "PUT"),
    build: async (c) => {
      const b = c.body ?? {};
      const who = await studentName(b.studentId);
      return {
        category: "Ödev",
        summary: `${who || "bir öğrencinin"} ödev durumunu "${String(b.status ?? "")}" olarak işaretledi`,
        details: { studentId: b.studentId, studentName: who, status: b.status, homeworkId: c.lastSegment },
      };
    },
  },
  // --- REHBERLİK ---
  {
    category: "Rehberlik",
    match: (c) => c.path === "/api/guidance-notes" && c.method === "POST",
    build: async (c) => {
      const b = c.body ?? {};
      const who = await studentName(b.studentId);
      // ⚠️ Not METNİ bilerek yazılmaz (gizlilik seviyeleri).
      return {
        category: "Rehberlik",
        summary: `${who} için rehberlik notu ekledi (gizlilik: ${String(b.confidentialityLevel ?? "RESTRICTED")})`,
        details: { studentId: b.studentId, studentName: who, category: b.category, confidentialityLevel: b.confidentialityLevel },
      };
    },
  },
  {
    category: "Rehberlik",
    match: (c) => c.path === "/api/guidance-program" && c.method === "POST",
    build: async (c) => {
      const b = c.body ?? {};
      const who = await studentName(b.studentId);
      const entries = Array.isArray(b.entries) ? b.entries.length : 0;
      return {
        category: "Rehberlik",
        summary: `${who} için "${String(b.weekLabel ?? "")}" çalışma programı yazdı (${entries} blok)`,
        details: { studentId: b.studentId, studentName: who, weekLabel: b.weekLabel, blocks: entries },
      };
    },
  },
  {
    category: "Rehberlik",
    match: (c) => c.path === "/api/guidance/meetings" && c.method === "POST",
    build: async (c) => {
      const b = c.body ?? {};
      const who = await studentName(b.studentId);
      return {
        category: "Rehberlik",
        summary: `${who} ile ${trDate(b.scheduledAt)} tarihine görüşme planladı — "${String(b.topic ?? "")}"`,
        details: { studentId: b.studentId, studentName: who, scheduledAt: b.scheduledAt, topic: b.topic },
      };
    },
  },
  // --- ÖDEME ---
  {
    category: "Ödeme",
    match: (c) => c.path.startsWith("/api/payments") && c.method === "POST",
    build: async (c) => {
      const b = c.body ?? {};
      const who = await studentName(b.studentId);
      const amount = typeof b.amount === "number" ? b.amount.toLocaleString("tr-TR") : "";
      return {
        category: "Ödeme",
        summary: `${who || "bir öğrenci"} için ödeme işlemi yaptı${amount ? ` — ${amount} TL` : ""}`,
        details: { studentId: b.studentId, studentName: who, amount: b.amount, method: b.method ?? b.paymentMethod },
      };
    },
  },
  // --- KULLANICI / ŞUBE YÖNETİMİ ---
  {
    category: "Kullanıcı yönetimi",
    match: (c) => c.path.startsWith("/api/admin/users") && c.method !== "GET",
    build: async (c) => {
      const b = c.body ?? {};
      const label = [b.firstName, b.lastName].filter(Boolean).join(" ");
      const verb = c.method === "DELETE" ? "sildi" : c.method === "POST" ? "ekledi" : "güncelledi";
      return {
        category: "Kullanıcı yönetimi",
        summary: `Kullanıcı kaydı ${verb}${label ? `: ${label}` : ""}`,
        details: { ...b, password: undefined },
      };
    },
  },
  {
    category: "Şube",
    match: (c) => c.path.startsWith("/api/admin/branches") && c.method !== "GET",
    build: async (c) => {
      const b = c.body ?? {};
      const verb = c.method === "DELETE" ? "sildi" : c.method === "POST" ? "açtı" : "güncelledi";
      return { category: "Şube", summary: `Şube ${verb}${b.name ? `: ${String(b.name)}` : ""}`, details: b };
    },
  },
  // --- DUYURU / SMS ---
  {
    category: "Duyuru / SMS",
    match: (c) => (c.path.startsWith("/api/announcements") || c.path.includes("/sms")) && c.method === "POST",
    build: async (c) => {
      const b = c.body ?? {};
      return {
        category: "Duyuru / SMS",
        summary: `Duyuru/SMS gönderdi${b.title ? `: "${String(b.title)}"` : ""}`,
        details: { title: b.title, audience: b.audience ?? b.targetRole },
      };
    },
  },
  // --- SINAV / DENEME ---
  {
    category: "Deneme / sınav",
    match: (c) => c.path.startsWith("/api/exams") && c.method !== "GET",
    build: async (c) => {
      const b = c.body ?? {};
      const verb = c.method === "DELETE" ? "sildi" : c.method === "POST" ? "oluşturdu" : "güncelledi";
      return {
        category: "Deneme / sınav",
        summary: `Deneme/sınav kaydı ${verb}${b.name ? `: ${String(b.name)}` : ""}`,
        details: { name: b.name, examDate: b.examDate },
      };
    },
  },
  // --- PANEL GÖRÜNTÜLEME ---
  {
    category: "Panel görüntüleme",
    match: (c) => c.path === "/api/admin/impersonate",
    build: async (c) => {
      if (c.method === "DELETE") {
        return { category: "Panel görüntüleme", summary: "Panel görüntülemeden çıktı", details: {} };
      }
      const b = c.body ?? {};
      const role = String(b.role ?? "");
      const name = role === "student" ? await studentName(b.userId) : await teacherName(b.userId);
      return {
        category: "Panel görüntüleme",
        summary: `${name || "bir kullanıcının"} paneline girdi (${b.write ? "düzenleme açık" : "salt okunur"})`,
        details: { role, userId: b.userId, targetName: name, write: b.write === true },
      };
    },
  },
];

/** Genel cümle — eşleşen bir tanımlayıcı yoksa kayıt yine de anlamlı kalsın. */
function fallback(ctx: Ctx): Described {
  const verb = ctx.method === "DELETE" ? "sildi" : ctx.method === "POST" ? "ekledi" : "güncelledi";
  return { category: "Diğer", summary: `${ctx.path} üzerinde kayıt ${verb}`, details: {} };
}

export async function describeAdminAction(input: {
  method: string;
  path: string;
  rawBody: string | null;
}): Promise<Described> {
  let body: Record<string, unknown> | null = null;
  if (input.rawBody) {
    try {
      const parsed = JSON.parse(input.rawBody);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      body = null;
    }
  }
  const ctx: Ctx = {
    method: input.method.toUpperCase(),
    path: input.path,
    body,
    lastSegment: input.path.split("/").filter(Boolean).pop() ?? "",
  };
  try {
    const describer = DESCRIBERS.find((d) => d.match(ctx));
    if (!describer) return fallback(ctx);
    return (await describer.build(ctx)) ?? fallback(ctx);
  } catch {
    // Anlamlandırma başarısız olsa bile KAYIT DÜŞMELİ — kanıtın kendisi
    // özetten daha önemli.
    return fallback(ctx);
  }
}
