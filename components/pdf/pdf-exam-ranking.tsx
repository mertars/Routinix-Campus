import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Sıralama Listesi — genel (tüm öğrenciler) YA DA alan bazlı (bkz.
// lib/server/exams/track-mapping.ts). Kullanıcı geri bildirimi: "sadece
// net yazıyor, ben her dersin sonucunu istiyorum" — artık her öğrenci
// satırında TÜM derslerin doğru/yanlış/net'i de var, sadece toplam değil.
// A4 YATAY: çok sayıda ders sütunu olduğunda dikeyde sıkışıyordu.
const COLORS = {
  text: "#1F2937",
  textMuted: "#6B7280",
  accentDark: "#065F46",
  accentSoft: "#ECFDF5",
  hairline: "#E5E7EB",
  headerBg: "#065F46",
  rowAlt: "#F9FAFB",
  gold: "#B45309",
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 8, paddingBottom: 28 },
  headerBand: { backgroundColor: COLORS.headerBg, paddingHorizontal: 28, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  logoImage: { width: 30, height: 30, borderRadius: 7, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 30, height: 30, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  institutionName: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold", marginLeft: 9 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 7 },
  headerValue: { color: "#FFFFFF", fontSize: 9, fontWeight: "bold" },

  summaryBar: { flexDirection: "row", paddingHorizontal: 28, paddingVertical: 7, backgroundColor: COLORS.accentSoft, gap: 20 },
  summaryLabel: { fontSize: 6.5, color: COLORS.textMuted, textTransform: "uppercase" },
  summaryValue: { fontSize: 9.5, fontWeight: "bold", color: COLORS.text, marginTop: 1 },

  body: { paddingHorizontal: 28, paddingTop: 10 },
  table: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 4, overflow: "hidden" },
  tHeadRow: { flexDirection: "row", backgroundColor: COLORS.accentDark },
  tHeadCell: { color: "#FFFFFF", fontSize: 6.3, fontWeight: "bold", paddingVertical: 4, paddingHorizontal: 3, textAlign: "center" },
  tHeadCellLeft: { color: "#FFFFFF", fontSize: 6.3, fontWeight: "bold", paddingVertical: 4, paddingHorizontal: 3, textAlign: "left" },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: COLORS.hairline },
  tRowAlt: { backgroundColor: COLORS.rowAlt },
  tCell: { fontSize: 7, paddingVertical: 3, paddingHorizontal: 3, color: COLORS.text, textAlign: "center" },
  tCellMuted: { fontSize: 6.3, paddingVertical: 3, paddingHorizontal: 3, color: COLORS.textMuted, textAlign: "center" },
  tCellBold: { fontSize: 7, paddingVertical: 3, paddingHorizontal: 3, color: COLORS.text, fontWeight: "bold", textAlign: "center" },
  rankBadge: { fontSize: 7.5, paddingVertical: 3, paddingHorizontal: 3, fontWeight: "bold", textAlign: "center" },

  colRank: { width: 24 },
  colName: { flex: 2.2, textAlign: "left" },
  colBranch: { flex: 1.1, textAlign: "left" },
  colSubjectNet: { flex: 0.85 },
  colTotal: { flex: 1 },

  footer: { position: "absolute", bottom: 12, left: 28, right: 28, textAlign: "center", fontSize: 6, color: COLORS.textMuted },
});

function t(v: string): string {
  return turkishSafe(v);
}

export type RankingSubjectCell = { correct: number; wrong: number; blank: number; net: number } | null;
export type RankingRow = { rank: number; firstName: string; lastName: string; branchName: string; subjects: RankingSubjectCell[]; totalNet: number };

export function PdfExamRanking({
  institutionName,
  logoUrl,
  examName,
  examDate,
  listTitle,
  subjects,
  totalLabel,
  rows,
}: {
  institutionName: string;
  logoUrl?: string | null;
  examName: string;
  examDate: string;
  // "Genel Sıralama" | "Sayısal Sıralaması" vb.
  listTitle: string;
  subjects: string[];
  // "Toplam Net" | "Sayısal Net" vb.
  totalLabel: string;
  rows: RankingRow[];
}) {
  const nets = rows.map((r) => r.totalNet);
  const avg = nets.length > 0 ? Math.round((nets.reduce((a, b) => a + b, 0) / nets.length) * 100) / 100 : 0;

  return (
    <Document title={t(`${examName} - ${listTitle}`)}>
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
            <Text style={styles.headerLabel}>{t(listTitle.toUpperCase())}</Text>
            <Text style={styles.headerValue}>
              {t(examName)} · {t(examDate)}
            </Text>
          </View>
        </View>

        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>{t("Katılımcı")}</Text>
            <Text style={styles.summaryValue}>{rows.length}</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>{t("Ortalama")}</Text>
            <Text style={styles.summaryValue}>{avg}</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>{t("En Yüksek")}</Text>
            <Text style={styles.summaryValue}>{nets.length > 0 ? Math.max(...nets) : 0}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.table}>
            <View style={styles.tHeadRow} fixed>
              <Text style={[styles.tHeadCell, styles.colRank]}>{t("Sıra")}</Text>
              <Text style={[styles.tHeadCellLeft, styles.colName]}>{t("Ad Soyad")}</Text>
              <Text style={[styles.tHeadCellLeft, styles.colBranch]}>{t("Şube")}</Text>
              {subjects.map((s) => (
                <Text key={s} style={[styles.tHeadCell, styles.colSubjectNet]}>
                  {t(s)}
                </Text>
              ))}
              <Text style={[styles.tHeadCell, styles.colTotal]}>{t(totalLabel.toUpperCase())}</Text>
            </View>
            {rows.map((r, i) => (
              <View key={`${r.rank}-${r.firstName}-${r.lastName}-${i}`} style={[styles.tRow, ...(i % 2 === 1 ? [styles.tRowAlt] : [])]} wrap={false}>
                <Text style={[styles.rankBadge, styles.colRank, { color: r.rank <= 3 ? COLORS.gold : COLORS.textMuted }]}>{r.rank}</Text>
                <Text style={[styles.tCellBold, styles.colName]}>
                  {t(r.firstName)} {t(r.lastName)}
                </Text>
                <Text style={[styles.tCellMuted, styles.colBranch]}>{t(r.branchName)}</Text>
                {r.subjects.map((sub, si) => (
                  <Text key={subjects[si]} style={[styles.tCell, styles.colSubjectNet]}>
                    {sub ? (
                      <>
                        {sub.net}
                        <Text style={styles.tCellMuted}> ({sub.correct}·{sub.wrong}·{sub.blank})</Text>
                      </>
                    ) : (
                      "—"
                    )}
                  </Text>
                ))}
                <Text style={[styles.tCellBold, styles.colTotal, { color: COLORS.accentDark, fontSize: 8 }]}>{r.totalNet}</Text>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 6, fontSize: 6, color: COLORS.textMuted }}>
            {t("Ders sütunlarındaki parantez içi sayılar sırasıyla doğru · yanlış · boş.")}
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")} · {t(new Date().toLocaleDateString("tr-TR"))}
        </Text>
      </Page>
    </Document>
  );
}
