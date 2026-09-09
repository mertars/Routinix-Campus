import { logger } from "@/lib/logger";
import { trStartOfDay, trEndOfDay, trEndOfDayIn, trMonthKey } from "./tr-time";
import { AGENDA_SOURCES } from "./sources";
import { HORIZON_ORDER } from "@/lib/agenda-types";
import type { Agenda, AgendaContext, AgendaHorizon, AgendaItem, AgendaSource, AgendaUrgency } from "./agenda-types";

export * from "./agenda-types";

/** Bugün dahil kaç günlük pencere "bu hafta" sayılır. */
const WEEK_DAYS = 7;

const URGENCY_ORDER: Record<AgendaUrgency, number> = { critical: 0, attention: 1, info: 2 };

export function buildAgendaContext(institutionId: string, now = new Date()): AgendaContext {
  return {
    institutionId,
    now,
    todayStart: trStartOfDay(now),
    todayEnd: trEndOfDay(now),
    weekEnd: trEndOfDayIn(now, WEEK_DAYS - 1),
    monthKey: trMonthKey(now),
  };
}

/** Tek kaynağı çalıştırır. Patlarsa gündemin TAMAMI düşmesin — logla, atla. */
export async function runSource(source: AgendaSource, ctx: AgendaContext): Promise<AgendaItem | null> {
  try {
    const hit = await source.load(ctx);
    if (!hit || hit.count <= 0) return null;
    return {
      key: source.key,
      horizon: source.horizon,
      area: source.area,
      urgency: hit.urgency ?? source.urgency,
      count: hit.count,
      title: hit.title,
      detail: hit.detail,
      tab: source.tab,
      href: source.href,
    };
  } catch (error) {
    // Bir maddenin sorgusu bozulduğunda müdür boş ekran görmemeli;
    // diğer 20 madde hâlâ doğru.
    logger.error("agenda_source_failed", { source: source.key, error: String(error) });
    return null;
  }
}

/**
 * @param sources Testlerde sahte kaynak vermek için; üretimde her zaman kayıt.
 */
export async function getAgenda(
  institutionId: string,
  now = new Date(),
  sources: AgendaSource[] = AGENDA_SOURCES
): Promise<Agenda> {
  const ctx = buildAgendaContext(institutionId, now);

  // Hepsi TEK turda koşar. Sıralı çalıştırmak 23 ağ turu demekti.
  const settled = await Promise.all(sources.map((source) => runSource(source, ctx)));
  const items = settled.filter((item): item is AgendaItem => item !== null);

  // Ufkun İÇİNDE aciliyete, eşitlikte sayıya göre: müdür listeyi
  // taramak zorunda kalmasın, üstteki madde gerçekten en önemlisi olsun.
  items.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || b.count - a.count);

  // Sayımlar HORIZON_ORDER'dan türetilir: yeni bir ufuk eklendiğinde
  // burayı güncellemeyi unutmak mümkün olmasın.
  const byHorizon = Object.fromEntries(
    HORIZON_ORDER.map((h) => [h, items.filter((i) => i.horizon === h).length])
  ) as Record<AgendaHorizon, number>;

  return {
    items,
    counts: { ...byHorizon, critical: items.filter((i) => i.urgency === "critical").length },
    allClear: items.length === 0,
  };
}
