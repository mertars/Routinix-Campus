// Gündem maddelerinden menü rozetlerini üretir.
//
// React'ten AYRI bir dosyada: vitest bu projede JSX dönüştürmüyor
// (tüm testler .ts), mantığın sınanabilir kalması için burada durur.

import type { AgendaItem, AgendaUrgency } from "@/lib/agenda-types";

export type NavBadge = { count: number; urgency: AgendaUrgency };

const URGENCY_RANK: Record<AgendaUrgency, number> = { critical: 3, attention: 2, info: 1 };

/** Aynı sekmeye birden fazla iş düşerse: sayılar toplanır, EN ACİL renk kazanır. */
export function toBadges(items: AgendaItem[] | null): Record<string, NavBadge> {
  if (!items) return {};
  const map: Record<string, NavBadge> = {};
  for (const item of items) {
    // Rozet yalnızca ERP sekmesi olan işler için çizilir; başka modüle
    // giden iş (ödeme paneli) bu menüde bir yere düşmez.
    if (!item.tab || item.count <= 0) continue;
    const current = map[item.tab];
    map[item.tab] = current
      ? {
          count: current.count + item.count,
          urgency: URGENCY_RANK[item.urgency] > URGENCY_RANK[current.urgency] ? item.urgency : current.urgency,
        }
      : { count: item.count, urgency: item.urgency };
  }
  return map;
}

/** Bir grubun içindeki en acil iş — grup kapalıyken de haber verilebilsin diye. */
export function topUrgency(ids: readonly string[], badges: Record<string, NavBadge>): AgendaUrgency | null {
  let best: AgendaUrgency | null = null;
  for (const id of ids) {
    const badge = badges[id];
    if (!badge) continue;
    if (!best || URGENCY_RANK[badge.urgency] > URGENCY_RANK[best]) best = badge.urgency;
  }
  return best;
}
