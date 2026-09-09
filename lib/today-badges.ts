// "Bugün" işlerinden menü rozetlerini üretir.
//
// React'ten AYRI bir dosyada: vitest bu projede JSX dönüştürmüyor
// (tüm testler .ts), mantığın sınanabilir kalması için burada durur.

export type TaskUrgency = "critical" | "attention" | "info";

export type TodayTask = {
  key: string;
  title: string;
  detail: string;
  count: number;
  urgency: TaskUrgency;
  /** ERP sekmesi — rozet yalnızca bunu taşıyan işler için çizilir. */
  tab?: string;
  /** Başka bir modüle giden iş (ör. ödeme paneli); ERP menüsünde rozeti olmaz. */
  href?: string;
};

export type NavBadge = { count: number; urgency: TaskUrgency };

const URGENCY_RANK: Record<TaskUrgency, number> = { critical: 3, attention: 2, info: 1 };

/** Aynı sekmeye birden fazla iş düşerse: sayılar toplanır, EN ACİL renk kazanır. */
export function toBadges(tasks: TodayTask[] | null): Record<string, NavBadge> {
  if (!tasks) return {};
  const map: Record<string, NavBadge> = {};
  for (const task of tasks) {
    if (!task.tab || task.count <= 0) continue;
    const current = map[task.tab];
    map[task.tab] = current
      ? {
          count: current.count + task.count,
          urgency: URGENCY_RANK[task.urgency] > URGENCY_RANK[current.urgency] ? task.urgency : current.urgency,
        }
      : { count: task.count, urgency: task.urgency };
  }
  return map;
}

/** Bir grubun içindeki en acil iş — grup kapalıyken de haber verilebilsin diye. */
export function topUrgency(ids: readonly string[], badges: Record<string, NavBadge>): TaskUrgency | null {
  let best: TaskUrgency | null = null;
  for (const id of ids) {
    const badge = badges[id];
    if (!badge) continue;
    if (!best || URGENCY_RANK[badge.urgency] > URGENCY_RANK[best]) best = badge.urgency;
  }
  return best;
}
