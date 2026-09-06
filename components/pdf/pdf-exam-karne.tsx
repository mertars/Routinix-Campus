import { Document, Page, View, Text, Image, Svg, Rect, Line, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Deneme Karnesi — Ölçme Değerlendirme'nin zümrüt/yeşil kimliğiyle (bkz.
// olcme-top-bar.tsx'teki AYNI gerekçe — her modülün kendi rengi var).
// Kullanıcının paylaştığı gerçek rakip örneklerine (Paradoks/edesis)
// bilerek YAKIN ama iki şeyi BİLEREK İÇERMİYOR — dürüst olmak adına:
//   1) Alt-ders kırılımı (TYT-SOSYAL BİLİMLER > Tarih/Coğrafya/...) —
//      bizim veri modelimiz soruyu doğrudan KAZANIMA bağlıyor, ayrı bir
//      "alt-ders" hiyerarşisi yok; bunu taklit etmek sahte bir yapı
//      uydurmak olurdu.
//   2) Öğrencinin YANLIŞ işaretlediği harf (ÖC) ve resmi ÖSYM puan/ülke
//      sıralaması (OSYM23/24/25 sütunları) — hiçbiri sistemde YOK: optik
//      okuma sadece "doğru/yanlış/boş" üretir (hangi yanlış şıkkı
//      işaretlediği ayrıca saklanmaz), resmi ÖSYM katsayıları da elimizde
//      yok. Var olmayan bir sayıyı uydurmak yerine bunları GÖSTERMİYORUZ.
const COLORS = {
  text: "#1F2937",
  textMuted: "#6B7280",
  accent: "#059669",
  accentDark: "#065F46",
  accentSoft: "#ECFDF5",
  hairline: "#E5E7EB",
  headerBg: "#065F46",
  rowAlt: "#F9FAFB",
  positive: "#059669",
  negative: "#DC2626",
  gold: "#B45309",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 9, paddingBottom: 36 },
  headerBand: { backgroundColor: COLORS.headerBg, paddingHorizontal: 32, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  logoImage: { width: 34, height: 34, borderRadius: 8, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
  institutionName: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold", marginLeft: 10 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 7.5 },
  headerValue: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "bold" },

  infoBar: { flexDirection: "row", paddingHorizontal: 32, paddingVertical: 10, backgroundColor: COLORS.accentSoft, gap: 18 },
  infoLabel: { fontSize: 7, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
  infoValue: { fontSize: 10, fontWeight: "bold", color: COLORS.text, marginTop: 1 },

  body: { paddingHorizontal: 32, paddingTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: COLORS.accentDark, marginBottom: 6, marginTop: 14 },

  table: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 4, overflow: "hidden" },
  tHeadRow: { flexDirection: "row", backgroundColor: COLORS.accentDark },
  tHeadCell: { color: "#FFFFFF", fontSize: 7.5, fontWeight: "bold", paddingVertical: 5, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: COLORS.hairline },
  tRowAlt: { backgroundColor: COLORS.rowAlt },
  tCell: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 4, color: COLORS.text },
  tCellMuted: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 4, color: COLORS.textMuted },
  tCellBold: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 4, color: COLORS.text, fontWeight: "bold" },

  colSubject: { flex: 3 },
  colNum: { flex: 1, textAlign: "center" },

  rankGrid: { flexDirection: "row", gap: 8, marginTop: 6 },
  rankCard: { flex: 1, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 6, padding: 8, alignItems: "center" },
  rankCardLabel: { fontSize: 7, color: COLORS.textMuted, textTransform: "uppercase" },
  rankCardValue: { fontSize: 14, fontWeight: "bold", color: COLORS.accentDark, marginTop: 2 },
  rankCardSuffix: { fontSize: 7, color: COLORS.textMuted },

  chartWrap: { marginTop: 8, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 6, padding: 10 },
  konuHeaderBand: { backgroundColor: COLORS.accentDark, paddingVertical: 4, paddingHorizontal: 6, marginTop: 12, marginBottom: 4, borderRadius: 3 },
  konuHeaderText: { color: "#FFFFFF", fontSize: 8, fontWeight: "bold" },

  footer: { position: "absolute", bottom: 14, left: 32, right: 32, textAlign: "center", fontSize: 6.5, color: COLORS.textMuted },
});

function t(v: string): string {
  return turkishSafe(v);
}

export type KarneSubjectRow = { subject: string; correct: number; wrong: number; blank: number; net: number; classAverage: number | null };
export type KarneTrendPoint = { label: string; net: number };
export type KarneKonuRow = { subject: string; questionNumber: number; konu: string; correctAnswer: string | null; isCorrect: boolean | null };

export type PdfExamKarneProps = {
  institutionName: string;
  logoUrl?: string | null;
  examName: string;
  examDate: string;
  studentName: string;
  branchName: string;
  studentNumber: string;
  subjects: KarneSubjectRow[];
  totalNet: number;
  studentCount: number;
  rank: number;
  branchStudentCount: number;
  branchRank: number;
  trackResult: { track: string; net: number; rank: number | null; studentCount: number } | null;
  trend: KarneTrendPoint[];
  konuRows: KarneKonuRow[];
};

function BarChart({ points }: { points: KarneTrendPoint[] }) {
  if (points.length === 0) return null;
  const W = 531;
  const H = 90;
  const PAD = { top: 8, bottom: 20, left: 4, right: 4 };
  const max = Math.max(...points.map((p) => p.net), 1);
  const gap = 6;
  const barW = (W - PAD.left - PAD.right - gap * (points.length - 1)) / points.length;
  const innerH = H - PAD.top - PAD.bottom;

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={PAD.left} y1={PAD.top + innerH} x2={W - PAD.right} y2={PAD.top + innerH} stroke={COLORS.hairline} strokeWidth={1} />
      {points.map((p, i) => {
        const barH = Math.max(2, (Math.max(p.net, 0) / max) * innerH);
        const x = PAD.left + i * (barW + gap);
        const y = PAD.top + innerH - barH;
        const isLast = i === points.length - 1;
        return <Rect key={i} x={x} y={y} width={barW} height={barH} fill={isLast ? COLORS.accent : "#A7D8C4"} rx={2} />;
      })}
    </Svg>
  );
}

export function PdfExamKarne(props: PdfExamKarneProps) {
  const {
    institutionName,
    logoUrl,
    examName,
    examDate,
    studentName,
    branchName,
    studentNumber,
    subjects,
    totalNet,
    studentCount,
    rank,
    branchStudentCount,
    branchRank,
    trackResult,
    trend,
    konuRows,
  } = props;

  const konuBySubject = new Map<string, KarneKonuRow[]>();
  for (const row of konuRows) konuBySubject.set(row.subject, [...(konuBySubject.get(row.subject) ?? []), row]);

  return (
    <Document title={t(`${studentName} - ${examName} Karnesi`)}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerBand}>
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image PDF çizim primitifi, alt kabul etmez
            <Image src={logoUrl} style={styles.logoImage} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>{t(institutionName).charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.institutionName}>{t(institutionName).toUpperCase()}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>{t("DENEME KARNESİ")}</Text>
            <Text style={styles.headerValue}>{t(examDate)}</Text>
          </View>
        </View>

        <View style={styles.infoBar}>
          <View>
            <Text style={styles.infoLabel}>{t("Ad Soyad")}</Text>
            <Text style={styles.infoValue}>{t(studentName)}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>{t("Şube")}</Text>
            <Text style={styles.infoValue}>{t(branchName)}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>{t("Öğrenci No")}</Text>
            <Text style={styles.infoValue}>{t(studentNumber)}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>{t("Sınav")}</Text>
            <Text style={styles.infoValue}>{t(examName)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>{t("DERS ANALİZİ")}</Text>
          <View style={styles.table}>
            <View style={styles.tHeadRow}>
              <Text style={[styles.tHeadCell, styles.colSubject]}>{t("DERS")}</Text>
              <Text style={[styles.tHeadCell, styles.colNum]}>{t("DOĞRU")}</Text>
              <Text style={[styles.tHeadCell, styles.colNum]}>{t("YANLIŞ")}</Text>
              <Text style={[styles.tHeadCell, styles.colNum]}>{t("BOŞ")}</Text>
              <Text style={[styles.tHeadCell, styles.colNum]}>{t("NET")}</Text>
              <Text style={[styles.tHeadCell, styles.colNum]}>{t("SINIF ORT.")}</Text>
            </View>
            {subjects.map((s, i) => (
              <View key={s.subject} style={[styles.tRow, ...(i % 2 === 1 ? [styles.tRowAlt] : [])]}>
                <Text style={[styles.tCellBold, styles.colSubject]}>{t(s.subject)}</Text>
                <Text style={[styles.tCell, styles.colNum]}>{s.correct}</Text>
                <Text style={[styles.tCell, styles.colNum]}>{s.wrong}</Text>
                <Text style={[styles.tCellMuted, styles.colNum]}>{s.blank}</Text>
                <Text style={[styles.tCellBold, styles.colNum, { color: COLORS.accentDark }]}>{s.net}</Text>
                <Text style={[styles.tCellMuted, styles.colNum]}>{s.classAverage ?? "—"}</Text>
              </View>
            ))}
            <View style={[styles.tRow, { backgroundColor: COLORS.accentSoft }]}>
              <Text style={[styles.tCellBold, styles.colSubject]}>{t("TOPLAM")}</Text>
              <Text style={[styles.tCell, styles.colNum]} />
              <Text style={[styles.tCell, styles.colNum]} />
              <Text style={[styles.tCell, styles.colNum]} />
              <Text style={[styles.tCellBold, styles.colNum, { color: COLORS.accentDark, fontSize: 10 }]}>{totalNet}</Text>
              <Text style={[styles.tCell, styles.colNum]} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t("PUAN VE SIRALAMALAR")}</Text>
          <View style={styles.rankGrid}>
            <View style={styles.rankCard}>
              <Text style={styles.rankCardLabel}>{t("Genel Sıralama")}</Text>
              <Text style={styles.rankCardValue}>{rank}</Text>
              <Text style={styles.rankCardSuffix}>/ {studentCount}</Text>
            </View>
            <View style={styles.rankCard}>
              <Text style={styles.rankCardLabel}>{t("Şube Sıralaması")}</Text>
              <Text style={styles.rankCardValue}>{branchRank}</Text>
              <Text style={styles.rankCardSuffix}>/ {branchStudentCount}</Text>
            </View>
            {trackResult && (
              <View style={styles.rankCard}>
                <Text style={styles.rankCardLabel}>{t(`${trackResult.track} Sıralaması`)}</Text>
                <Text style={styles.rankCardValue}>{trackResult.rank ?? "—"}</Text>
                <Text style={styles.rankCardSuffix}>
                  / {trackResult.studentCount} · {t("net")} {trackResult.net}
                </Text>
              </View>
            )}
          </View>

          {trend.length > 1 && (
            <>
              <Text style={styles.sectionTitle}>{t(`SON ${trend.length} SINAVIN NET GELİŞİMİ`)}</Text>
              <View style={styles.chartWrap}>
                <BarChart points={trend} />
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")} · {t(new Date().toLocaleDateString("tr-TR"))}
        </Text>
      </Page>

      {konuBySubject.size > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <View style={styles.headerBand}>
            <Text style={styles.institutionName}>{t("KONU ANALİZİ")}</Text>
            <View style={styles.headerRight}>
              <Text style={styles.headerValue}>{t(studentName)}</Text>
            </View>
          </View>
          <View style={styles.body}>
            {[...konuBySubject.entries()].map(([subject, rows]) => (
              <View key={subject} wrap={false}>
                <View style={styles.konuHeaderBand}>
                  <Text style={styles.konuHeaderText}>{t(subject.toUpperCase())}</Text>
                </View>
                <View style={styles.table}>
                  <View style={styles.tHeadRow}>
                    <Text style={[styles.tHeadCell, { flex: 0.6 }]}>{t("No")}</Text>
                    <Text style={[styles.tHeadCell, { flex: 3 }]}>{t("Konu")}</Text>
                    <Text style={[styles.tHeadCell, { flex: 0.8 }]}>{t("DC")}</Text>
                    <Text style={[styles.tHeadCell, { flex: 0.8 }]}>{t("Sonuç")}</Text>
                  </View>
                  {rows
                    .sort((a, b) => a.questionNumber - b.questionNumber)
                    .map((r, i) => (
                      <View key={r.questionNumber} style={[styles.tRow, ...(i % 2 === 1 ? [styles.tRowAlt] : [])]}>
                        <Text style={[styles.tCellMuted, { flex: 0.6 }]}>{r.questionNumber}</Text>
                        <Text style={[styles.tCell, { flex: 3 }]}>{t(r.konu)}</Text>
                        <Text style={[styles.tCellBold, { flex: 0.8 }]}>{r.correctAnswer ?? "—"}</Text>
                        <Text
                          style={[
                            styles.tCellBold,
                            { flex: 0.8, color: r.isCorrect === null ? COLORS.textMuted : r.isCorrect ? COLORS.positive : COLORS.negative },
                          ]}
                        >
                          {r.isCorrect === null ? "boş" : r.isCorrect ? "+" : "-"}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.footer} fixed>
            {t("Routinix Kampüs — Ölçme Değerlendirme")}
          </Text>
        </Page>
      )}
    </Document>
  );
}
