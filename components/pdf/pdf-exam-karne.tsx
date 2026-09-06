import { Document, Page, View, Text, Image, Svg, Rect, Line, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Deneme Karnesi — Ölçme Değerlendirme'nin zümrüt/yeşil kimliğiyle. YATAY
// (landscape) A4: kullanıcı geri bildirimi — dikey sayfada ders sütunları
// sıkışıyordu, alt-ders satırları eklenince daha da dar kaldı. Yatayda
// hem DERS ANALİZİ tablosu hem KONU ANALİZİ'nin çok-sütunlu düzeni rahat
// sığıyor.
//
// Kullanıcının paylaştığı gerçek rakip örneklerine (Paradoks/edesis)
// bilerek YAKIN ama BİR ŞEYİ hâlâ İÇERMİYOR — dürüst olmak adına: resmi
// ÖSYM puanı (o yılın TÜM Türkiye adaylarının istatistiğine göre hesaplanır,
// bu veri ÖSYM'nin kendisinde, bizde YOK). "Tahmini Sıralama" SADECE
// kurumun kendi girdiği referans tabloya göre (bkz. osym-reference.ts) —
// varsa gösterilir, "kurum tahmini" etiketiyle; resmi bir OSYM23/24/25
// sütunu YOK, uydurmadık.
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
  subRow: "#F3F4F6",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 8.5, paddingBottom: 30 },
  headerBand: { backgroundColor: COLORS.headerBg, paddingHorizontal: 28, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  logoImage: { width: 30, height: 30, borderRadius: 7, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 30, height: 30, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  institutionName: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold", marginLeft: 9 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 7 },
  headerValue: { color: "#FFFFFF", fontSize: 9, fontWeight: "bold" },

  infoBar: { flexDirection: "row", paddingHorizontal: 28, paddingVertical: 8, backgroundColor: COLORS.accentSoft, gap: 22 },
  infoLabel: { fontSize: 6.5, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
  infoValue: { fontSize: 9.5, fontWeight: "bold", color: COLORS.text, marginTop: 1 },

  body: { paddingHorizontal: 28, paddingTop: 12, flexDirection: "row", gap: 16 },
  colLeft: { flex: 1.55 },
  colRight: { flex: 1 },
  sectionTitle: { fontSize: 9, fontWeight: "bold", color: COLORS.accentDark, marginBottom: 5, marginTop: 10 },

  table: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 4, overflow: "hidden" },
  tHeadRow: { flexDirection: "row", backgroundColor: COLORS.accentDark },
  tHeadCell: { color: "#FFFFFF", fontSize: 6.8, fontWeight: "bold", paddingVertical: 4, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: COLORS.hairline },
  tRowAlt: { backgroundColor: COLORS.rowAlt },
  tSubRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: COLORS.hairline, backgroundColor: COLORS.subRow },
  tCell: { fontSize: 7.5, paddingVertical: 3.5, paddingHorizontal: 4, color: COLORS.text },
  tCellMuted: { fontSize: 7.5, paddingVertical: 3.5, paddingHorizontal: 4, color: COLORS.textMuted },
  tCellBold: { fontSize: 7.5, paddingVertical: 3.5, paddingHorizontal: 4, color: COLORS.text, fontWeight: "bold" },
  tCellSub: { fontSize: 7, paddingVertical: 3, paddingHorizontal: 4, color: COLORS.textMuted, paddingLeft: 12 },

  colSubject: { flex: 3 },
  colNum: { flex: 1, textAlign: "center" },

  rankGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  rankCard: { flexGrow: 1, flexBasis: "30%", borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 6, padding: 7, alignItems: "center" },
  rankCardLabel: { fontSize: 6.3, color: COLORS.textMuted, textTransform: "uppercase", textAlign: "center" },
  rankCardValue: { fontSize: 13, fontWeight: "bold", color: COLORS.accentDark, marginTop: 2 },
  rankCardSuffix: { fontSize: 6.3, color: COLORS.textMuted, textAlign: "center" },

  chartWrap: { marginTop: 4, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 6, padding: 8 },
  konuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  konuCol: { flexBasis: "48%", flexGrow: 1 },
  konuHeaderBand: { backgroundColor: COLORS.accentDark, paddingVertical: 3.5, paddingHorizontal: 6, marginBottom: 3, borderRadius: 3 },
  konuHeaderText: { color: "#FFFFFF", fontSize: 7.5, fontWeight: "bold" },

  footer: { position: "absolute", bottom: 12, left: 28, right: 28, textAlign: "center", fontSize: 6, color: COLORS.textMuted },
});

function t(v: string): string {
  return turkishSafe(v);
}

export type KarneSubjectRow = {
  subject: string;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  classAverage: number | null;
  subRows: { label: string; correct: number; wrong: number; blank: number; net: number }[];
};
export type KarneTrendPoint = { label: string; net: number };
export type KarneKonuRow = { subject: string; questionNumber: number; konu: string; correctAnswer: string | null; studentAnswer: string | null; isCorrect: boolean | null };

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
  osymEstimate: { tableName: string; estimatedRanking: number } | null;
  trend: KarneTrendPoint[];
  konuRows: KarneKonuRow[];
};

function BarChart({ points }: { points: KarneTrendPoint[] }) {
  if (points.length === 0) return null;
  const W = 300;
  const H = 70;
  const PAD = { top: 8, bottom: 16, left: 4, right: 4 };
  const max = Math.max(...points.map((p) => p.net), 1);
  const gap = 5;
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
    osymEstimate,
    trend,
    konuRows,
  } = props;

  const konuBySubject = new Map<string, KarneKonuRow[]>();
  for (const row of konuRows) konuBySubject.set(row.subject, [...(konuBySubject.get(row.subject) ?? []), row]);

  return (
    <Document title={t(`${studentName} - ${examName} Karnesi`)}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
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
          <View style={styles.colLeft}>
            <Text style={styles.sectionTitle}>{t("DERS ANALİZİ")}</Text>
            <View style={styles.table}>
              <View style={styles.tHeadRow}>
                <Text style={[styles.tHeadCell, styles.colSubject]}>{t("DERS")}</Text>
                <Text style={[styles.tHeadCell, styles.colNum]}>{t("D")}</Text>
                <Text style={[styles.tHeadCell, styles.colNum]}>{t("Y")}</Text>
                <Text style={[styles.tHeadCell, styles.colNum]}>{t("B")}</Text>
                <Text style={[styles.tHeadCell, styles.colNum]}>{t("NET")}</Text>
                <Text style={[styles.tHeadCell, styles.colNum]}>{t("SINIF ORT.")}</Text>
              </View>
              {subjects.map((s, i) => (
                <View key={s.subject}>
                  <View style={[styles.tRow, ...(i % 2 === 1 ? [styles.tRowAlt] : [])]}>
                    <Text style={[styles.tCellBold, styles.colSubject]}>{t(s.subject)}</Text>
                    <Text style={[styles.tCell, styles.colNum]}>{s.correct}</Text>
                    <Text style={[styles.tCell, styles.colNum]}>{s.wrong}</Text>
                    <Text style={[styles.tCellMuted, styles.colNum]}>{s.blank}</Text>
                    <Text style={[styles.tCellBold, styles.colNum, { color: COLORS.accentDark }]}>{s.net}</Text>
                    <Text style={[styles.tCellMuted, styles.colNum]}>{s.classAverage ?? "—"}</Text>
                  </View>
                  {s.subRows.map((sub) => (
                    <View key={sub.label} style={styles.tSubRow}>
                      <Text style={[styles.tCellSub, styles.colSubject]}>{t(sub.label)}</Text>
                      <Text style={[styles.tCellSub, styles.colNum]}>{sub.correct}</Text>
                      <Text style={[styles.tCellSub, styles.colNum]}>{sub.wrong}</Text>
                      <Text style={[styles.tCellSub, styles.colNum]}>{sub.blank}</Text>
                      <Text style={[styles.tCellSub, styles.colNum, { fontWeight: "bold" }]}>{sub.net}</Text>
                      <Text style={[styles.tCellSub, styles.colNum]} />
                    </View>
                  ))}
                </View>
              ))}
              <View style={[styles.tRow, { backgroundColor: COLORS.accentSoft }]}>
                <Text style={[styles.tCellBold, styles.colSubject]}>{t("TOPLAM")}</Text>
                <Text style={[styles.tCell, styles.colNum]} />
                <Text style={[styles.tCell, styles.colNum]} />
                <Text style={[styles.tCell, styles.colNum]} />
                <Text style={[styles.tCellBold, styles.colNum, { color: COLORS.accentDark, fontSize: 9 }]}>{totalNet}</Text>
                <Text style={[styles.tCell, styles.colNum]} />
              </View>
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

          <View style={styles.colRight}>
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
                  <Text style={styles.rankCardSuffix}>/ {trackResult.studentCount}</Text>
                </View>
              )}
              {osymEstimate && (
                <View style={[styles.rankCard, { borderColor: COLORS.gold }]}>
                  <Text style={[styles.rankCardLabel, { color: COLORS.gold }]}>{t("Tahmini Sıralama*")}</Text>
                  <Text style={[styles.rankCardValue, { color: COLORS.gold }]}>{osymEstimate.estimatedRanking.toLocaleString("tr-TR")}</Text>
                  <Text style={styles.rankCardSuffix}>{t(osymEstimate.tableName)}</Text>
                </View>
              )}
            </View>
            {osymEstimate && (
              <Text style={{ marginTop: 6, fontSize: 6, color: COLORS.textMuted, lineHeight: 1.4 }}>
                {t("* Resmi ÖSYM sıralaması DEĞİLDİR — kurumun kendi girdiği referans tabloya göre yapılan bir tahmindir.")}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")} · {t(new Date().toLocaleDateString("tr-TR"))}
        </Text>
      </Page>

      {konuBySubject.size > 0 && (
        <Page size="A4" orientation="landscape" style={styles.page} wrap>
          <View style={styles.headerBand}>
            <Text style={styles.institutionName}>{t("KONU ANALİZİ")}</Text>
            <View style={styles.headerRight}>
              <Text style={styles.headerValue}>{t(studentName)}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 28, paddingTop: 12 }}>
            <View style={styles.konuGrid}>
              {[...konuBySubject.entries()].map(([subject, rows]) => (
                <View key={subject} style={styles.konuCol} wrap={false}>
                  <View style={styles.konuHeaderBand}>
                    <Text style={styles.konuHeaderText}>{t(subject.toUpperCase())}</Text>
                  </View>
                  <View style={styles.table}>
                    <View style={styles.tHeadRow}>
                      <Text style={[styles.tHeadCell, { flex: 0.5 }]}>{t("No")}</Text>
                      <Text style={[styles.tHeadCell, { flex: 2.6 }]}>{t("Konu")}</Text>
                      <Text style={[styles.tHeadCell, { flex: 0.6, textAlign: "center" }]}>{t("DC")}</Text>
                      <Text style={[styles.tHeadCell, { flex: 0.6, textAlign: "center" }]}>{t("ÖC")}</Text>
                      <Text style={[styles.tHeadCell, { flex: 0.6, textAlign: "center" }]}>{t("SO")}</Text>
                    </View>
                    {rows
                      .sort((a, b) => a.questionNumber - b.questionNumber)
                      .map((r, i) => (
                        <View key={r.questionNumber} style={[styles.tRow, ...(i % 2 === 1 ? [styles.tRowAlt] : [])]}>
                          <Text style={[styles.tCellMuted, { flex: 0.5, textAlign: "center" }]}>{r.questionNumber}</Text>
                          <Text style={[styles.tCell, { flex: 2.6 }]}>{t(r.konu)}</Text>
                          <Text style={[styles.tCellBold, { flex: 0.6, textAlign: "center" }]}>{r.correctAnswer ?? "—"}</Text>
                          <Text style={[styles.tCellBold, { flex: 0.6, textAlign: "center" }]}>{r.isCorrect === null ? "—" : (r.studentAnswer ?? "—")}</Text>
                          <Text
                            style={[
                              styles.tCellBold,
                              { flex: 0.6, textAlign: "center", color: r.isCorrect === null ? COLORS.textMuted : r.isCorrect ? COLORS.positive : COLORS.negative },
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
          </View>
          <Text style={styles.footer} fixed>
            {t("Routinix Kampüs — Ölçme Değerlendirme")}
          </Text>
        </Page>
      )}
    </Document>
  );
}
