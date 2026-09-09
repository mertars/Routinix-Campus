// Rehberlik notlarının VELİYE görünürlüğü.
//
// Kural burada, tek bir POZİTİF liste olarak durur. Route'un içine
// gömülü bir Prisma koşulu olarak bırakılsaydı test edilemezdi; asıl
// önemlisi, negatif yazılma riski taşırdı.
//
// ⚠️ NEDEN POZİTİF LİSTE: "CONFIDENTIAL olmayanlar" gibi bir kural
// bugün doğru çalışır ama şemaya yarın eklenecek yeni bir seviye
// (örneğin "yalnızca öğrenci") KENDİLİĞİNDEN veliye açılırdı. Pozitif
// listede yeni seviye görünmez; görünmesi isteniyorsa buraya bilerek
// eklenir. Sessiz açılma yerine sessiz kapalılık tercih edilir.
export const PARENT_VISIBLE_CONFIDENTIALITY = ["PUBLIC"] as const;

export type ParentVisibleConfidentiality = (typeof PARENT_VISIBLE_CONFIDENTIALITY)[number];
