import type { AgendaSource } from "../agenda-types";
import { ATTENDANCE_SOURCES } from "./attendance";
import { EXAM_SOURCES } from "./exams";
import { FINANCE_SOURCES } from "./finance";
import { GUIDANCE_SOURCES } from "./guidance";
import { ROSTER_SOURCES } from "./roster";

// Gündemin TEK kaydı. Yeni bir iş eklemek = ilgili alan dosyasına bir
// nesne eklemek; burada ve panelde başka hiçbir yerde değişiklik
// gerekmez.
export const AGENDA_SOURCES: AgendaSource[] = [
  ...ATTENDANCE_SOURCES,
  ...FINANCE_SOURCES,
  ...EXAM_SOURCES,
  ...GUIDANCE_SOURCES,
  ...ROSTER_SOURCES,
];
