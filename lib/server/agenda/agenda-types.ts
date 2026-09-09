// Gündemin SUNUCU tarafı sözleşmesi. Ortak tipler (AgendaItem, ufuklar,
// etiketler) lib/agenda-types.ts'te — istemci de onları okuyor. Burada
// yalnızca kaynakların kendisini ilgilendiren şeyler var.
//
// MİMARİ — neden kaynak kaydı (registry):
// İlk hâlde altı iş tek fonksiyonda satır satır yazılıydı. Yirmiden
// fazla iş için bu sürdürülemez: her yeni madde fonksiyonu büyütür,
// Promise.all dizisiyle sonuç dizisinin sırasını elle eşlemek gerekir
// ve bir maddenin hatası tüm paneli düşürür. Bunun yerine her iş
// KENDİ KENDİNE YETEN bir nesne: nereye ait olduğunu, ne kadar acil
// olduğunu, nereye götürdüğünü ve kendini nasıl sayacağını kendi bilir.
// Yeni madde eklemek = ilgili alan dosyasına bir nesne eklemek.

import type { AgendaArea, AgendaHorizon, AgendaUrgency } from "@/lib/agenda-types";

export * from "@/lib/agenda-types";

export type AgendaContext = {
  institutionId: string;
  now: Date;
  /** Türkiye takvimine göre bugünün başı/sonu — bkz. tr-time.ts. */
  todayStart: Date;
  todayEnd: Date;
  /** Bugün dahil 7 günün sonu. */
  weekEnd: Date;
  /** "2026-09" — tekrarlayan gider ve bordro bu anahtarla karşılaştırılır. */
  monthKey: string;
};

/** Bir kaynağın bulgusu. Sayı 0 ya da null ise madde panele HİÇ girmez. */
export type AgendaHit = {
  count: number;
  title: string;
  detail: string;
  /** Kaynak, bulduğu duruma göre aciliyeti yükseltebilir (ör. süresi dolmak üzere olan sözleşme). */
  urgency?: AgendaUrgency;
};

export type AgendaSource = {
  key: string;
  horizon: AgendaHorizon;
  area: AgendaArea;
  urgency: AgendaUrgency;
  tab?: string;
  href?: string;
  /**
   * ⚠️ SAYIM sorgusu olmalı. Bu uç nokta her Genel Bakış açılışında
   * koşuyor; satır çeken bir kaynak tüm gündemi yavaşlatır. Satır
   * gerekiyorsa sınırlı çek ve nedenini yaz.
   *
   * ⚠️ Kaynak içinde birden fazla sorgu varsa BİRBİRİNDEN BAĞIMSIZ
   * olanları Promise.all'a al: ölçüldü, her ardışık sorgu tam bir ağ
   * turu (uzak veritabanında ~70 ms) ekliyor.
   */
  load: (ctx: AgendaContext) => Promise<AgendaHit | null>;
};
