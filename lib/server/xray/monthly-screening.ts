// Faz N — aylık "unutma riski" tarama testinin sabit soru sayısı üst
// sınırı. lib/server/xray/practice-pool.ts > capSelection ile birlikte
// kullanılır (bkz. o dosyadaki yorum).
export const MONTHLY_SCREENING_QUESTION_COUNT = 20;

export const SCREENING_GRADES = [9, 10, 11, 12] as const;
