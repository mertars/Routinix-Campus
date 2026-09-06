import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Sıralama Listesi — genel (tüm öğrenciler, toplam net) YA DA alan bazlı
// (bkz. lib/server/exams/track-mapping.ts — bir AYT denemesinde "Eşit
// Ağırlık Sıralaması", "Sayısal Sıralaması" gibi ayrı listeler). Aynı
// tablo bileşeni iki durumda da kullanılır, sadece net sütununun etiketi
// ve öğrenci listesinin kaynağı değişir.
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
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 9, paddingBottom: 36 },
  headerBand: { backgroundColor: COLORS.headerBg, paddingHorizontal: 32, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  logoImage: { width: 34, height: 34, borderRadius: 8, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 34, height: 34, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
  institutionName: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold", marginLeft: 10 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 7.5 },
  headerValue: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "bold" },

  body: { paddingHorizontal: 32, paddingTop: 16 },
  table: { borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 4, overflow: "hidden" },
  tHeadRow: { flexDirection: "row", backgroundColor: COLORS.accentDark },
  tHeadCell: { color: "#FFFFFF", fontSize: 7.5, fontWeight: "bold", paddingVertical: 5, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: COLORS.hairline },
  tRowAlt: { backgroundColor: COLORS.rowAlt },
  tCell: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 4, color: COLORS.text },
  tCellMuted: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 4, color: COLORS.textMuted },
  tCellBold: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 4, color: COLORS.text, fontWeight: "bold" },
  rankBadge: { fontSize: 8.5, paddingVertical: 4, paddingHorizontal: 4, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 14, left: 32, right: 32, textAlign: "center", fontSize: 6.5, color: COLORS.textMuted },
});

function t(v: string): string {
  return turkishSafe(v);
}

export type RankingRow = { rank: number; firstName: string; lastName: string; branchName: string; net: number };

export function PdfExamRanking({
  institutionName,
  logoUrl,
  examName,
  examDate,
  listTitle,
  netLabel,
  rows,
}: {
  institutionName: string;
  logoUrl?: string | null;
  examName: string;
  examDate: string;
  // "Genel Sıralama" | "Eşit Ağırlık Sıralaması" | "Sayısal Sıralaması" vb.
  listTitle: string;
  netLabel: string;
  rows: RankingRow[];
}) {
  return (
    <Document title={t(`${examName} - ${listTitle}`)}>
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
            <Text style={styles.headerLabel}>{t(listTitle.toUpperCase())}</Text>
            <Text style={styles.headerValue}>
              {t(examName)} · {t(examDate)}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.table}>
            <View style={styles.tHeadRow}>
              <Text style={[styles.tHeadCell, { flex: 0.7 }]}>{t("Sıra")}</Text>
              <Text style={[styles.tHeadCell, { flex: 3 }]}>{t("Ad Soyad")}</Text>
              <Text style={[styles.tHeadCell, { flex: 1.5 }]}>{t("Şube")}</Text>
              <Text style={[styles.tHeadCell, { flex: 1 }]}>{t(netLabel)}</Text>
            </View>
            {rows.map((r, i) => (
              <View key={`${r.rank}-${r.firstName}-${r.lastName}-${i}`} style={[styles.tRow, ...(i % 2 === 1 ? [styles.tRowAlt] : [])]} wrap={false}>
                <Text style={[styles.rankBadge, { flex: 0.7, color: r.rank <= 3 ? COLORS.gold : COLORS.textMuted }]}>{r.rank}</Text>
                <Text style={[styles.tCellBold, { flex: 3 }]}>
                  {t(r.firstName)} {t(r.lastName)}
                </Text>
                <Text style={[styles.tCellMuted, { flex: 1.5 }]}>{t(r.branchName)}</Text>
                <Text style={[styles.tCellBold, { flex: 1, color: COLORS.accentDark }]}>{r.net}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")} · {t(new Date().toLocaleDateString("tr-TR"))}
        </Text>
      </Page>
    </Document>
  );
}
