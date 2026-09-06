import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// Sıralama Listesi — kullanıcının gerçek örnek attığı "TYT Puan Sıralı
// Liste" / "İsim Sıralı Liste" formatına BİREBİR yakın: her ders (ve varsa
// alt-dersi) KENDİ Doğru/Yanlış/Net sütunlarını taşır, tek bir birleşik
// hücre YOK. Yoğun bir tablo olduğu için genişlikler FLEX değil SABİT
// (pt) — iki başlık satırı (ders adı + D/Y/N alt başlığı) ile gövde
// hücrelerinin TAM hizalanması gerekiyor, flex'in yeniden dağıtımı bunu
// bozardı.
//
// Kullanıcı kararı: BOŞ sayısı her ders için ayrı sütun DEĞİL (örnekteki
// gerçek üründe de yok, tablo zaten çok dar sütunlu) — TOPLAM'da ayrı bir
// sütun olarak var, "boşlar da ayrı sütunda olsun" isteği orada karşılanıyor.
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

const W = {
  no: 16,
  name: 82,
  branch: 26,
  dy: 13,
  net: 20,
  totalDyb: 14,
  totalNet: 22,
  rank: 22,
  estimate: 34,
};

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, fontSize: 6, paddingBottom: 24, paddingTop: 0 },
  headerBand: { backgroundColor: COLORS.headerBg, paddingHorizontal: 20, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  logoImage: { width: 24, height: 24, borderRadius: 6, objectFit: "contain", backgroundColor: "#FFFFFF" },
  logoFallback: { width: 24, height: 24, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 11, fontWeight: "bold" },
  institutionName: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold", marginLeft: 7 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerLabel: { color: "rgba(255,255,255,0.75)", fontSize: 6.5 },
  headerValue: { color: "#FFFFFF", fontSize: 8, fontWeight: "bold" },

  summaryBar: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, paddingVertical: 5, backgroundColor: COLORS.accentSoft, gap: 12 },
  summaryLabel: { fontSize: 5.3, color: COLORS.textMuted, textTransform: "uppercase" },
  summaryValue: { fontSize: 8, fontWeight: "bold", color: COLORS.text, marginTop: 0.5 },

  body: { paddingHorizontal: 20, paddingTop: 8 },
  table: { borderWidth: 0.5, borderColor: COLORS.hairline },

  groupHeadRow: { flexDirection: "row", backgroundColor: COLORS.accentDark },
  groupHeadCell: { color: "#FFFFFF", fontSize: 5.6, fontWeight: "bold", paddingVertical: 2, textAlign: "center", borderLeftWidth: 0.5, borderLeftColor: "rgba(255,255,255,0.25)" },
  subHeadRow: { flexDirection: "row", backgroundColor: "#0B7A56" },
  subHeadCell: { color: "#FFFFFF", fontSize: 5, fontWeight: "bold", textAlign: "center", paddingVertical: 1.5, borderLeftWidth: 0.5, borderLeftColor: "rgba(255,255,255,0.2)" },

  bodyRow: { flexDirection: "row", borderTopWidth: 0.4, borderTopColor: COLORS.hairline },
  bodyRowAlt: { backgroundColor: COLORS.rowAlt },
  cellFixed: { fontSize: 5.6, paddingVertical: 2, textAlign: "center", color: COLORS.text },
  cellFixedLeft: { fontSize: 5.8, paddingVertical: 2, paddingLeft: 2, textAlign: "left", color: COLORS.text },
  cellMuted: { fontSize: 5.6, paddingVertical: 2, textAlign: "center", color: COLORS.textMuted },
  cellBold: { fontSize: 5.8, paddingVertical: 2, textAlign: "center", color: COLORS.text, fontWeight: "bold" },
  rankCell: { fontSize: 6.3, paddingVertical: 2, textAlign: "center", fontWeight: "bold" },

  footer: { position: "absolute", bottom: 10, left: 20, right: 20, textAlign: "center", fontSize: 5.5, color: COLORS.textMuted },
  pageTitleBand: { paddingHorizontal: 20, paddingTop: 6 },
  pageTitle: { fontSize: 8, fontWeight: "bold", color: COLORS.accentDark },
});

function t(v: string): string {
  return turkishSafe(v);
}

export type RankingColumnGroup = { label: string };
export type RankingStudentRow = {
  firstName: string;
  lastName: string;
  branchName: string;
  cells: ({ correct: number; wrong: number; net: number } | null)[]; // columnGroups ile AYNI sırada
  totalCorrect: number;
  totalWrong: number;
  totalBlank: number;
  totalNet: number;
  rank: number;
  branchRank: number;
  gradeRank: number;
  estimatedRanking: number | null;
};

function DataTable({ columnGroups, rows, hasEstimate }: { columnGroups: RankingColumnGroup[]; rows: RankingStudentRow[]; hasEstimate: boolean }) {
  return (
    <View style={styles.table}>
      <View style={styles.groupHeadRow} fixed>
        <Text style={[styles.groupHeadCell, { width: W.no, borderLeftWidth: 0 }]}>{t("No")}</Text>
        <Text style={[styles.groupHeadCell, { width: W.name, textAlign: "left", paddingLeft: 2 }]}>{t("Adı Soyadı")}</Text>
        <Text style={[styles.groupHeadCell, { width: W.branch }]}>{t("Şb")}</Text>
        {columnGroups.map((g) => (
          <Text key={g.label} style={[styles.groupHeadCell, { width: W.dy * 2 + W.net }]}>
            {t(g.label)}
          </Text>
        ))}
        <Text style={[styles.groupHeadCell, { width: W.totalDyb * 3 + W.totalNet }]}>{t("TOPLAM")}</Text>
        <Text style={[styles.groupHeadCell, { width: W.rank * 3 }]}>{t("SIRALAMA")}</Text>
        {hasEstimate && <Text style={[styles.groupHeadCell, { width: W.estimate }]}>{t("TAHMİNİ")}</Text>}
      </View>
      <View style={styles.subHeadRow} fixed>
        <Text style={[styles.subHeadCell, { width: W.no, borderLeftWidth: 0 }]} />
        <Text style={[styles.subHeadCell, { width: W.name }]} />
        <Text style={[styles.subHeadCell, { width: W.branch }]} />
        {columnGroups.map((g) => (
          <View key={g.label} style={{ flexDirection: "row" }}>
            <Text style={[styles.subHeadCell, { width: W.dy }]}>{t("D")}</Text>
            <Text style={[styles.subHeadCell, { width: W.dy }]}>{t("Y")}</Text>
            <Text style={[styles.subHeadCell, { width: W.net }]}>{t("N")}</Text>
          </View>
        ))}
        <Text style={[styles.subHeadCell, { width: W.totalDyb }]}>{t("D")}</Text>
        <Text style={[styles.subHeadCell, { width: W.totalDyb }]}>{t("Y")}</Text>
        <Text style={[styles.subHeadCell, { width: W.totalDyb }]}>{t("B")}</Text>
        <Text style={[styles.subHeadCell, { width: W.totalNet }]}>{t("NET")}</Text>
        <Text style={[styles.subHeadCell, { width: W.rank }]}>{t("Genel")}</Text>
        <Text style={[styles.subHeadCell, { width: W.rank }]}>{t("Şube")}</Text>
        <Text style={[styles.subHeadCell, { width: W.rank }]}>{t("Sınıf")}</Text>
        {hasEstimate && <Text style={[styles.subHeadCell, { width: W.estimate }]} />}
      </View>

      {rows.map((r, i) => (
        <View key={`${r.firstName}-${r.lastName}-${i}`} style={[styles.bodyRow, ...(i % 2 === 1 ? [styles.bodyRowAlt] : [])]} wrap={false}>
          <Text style={[styles.cellMuted, { width: W.no }]}>{i + 1}</Text>
          <Text style={[styles.cellFixedLeft, { width: W.name }]}>
            {t(r.firstName)} {t(r.lastName)}
          </Text>
          <Text style={[styles.cellMuted, { width: W.branch }]}>{t(r.branchName)}</Text>
          {r.cells.map((c, ci) => (
            <View key={ci} style={{ flexDirection: "row" }}>
              <Text style={[styles.cellFixed, { width: W.dy }]}>{c ? c.correct : "—"}</Text>
              <Text style={[styles.cellFixed, { width: W.dy }]}>{c ? c.wrong : ""}</Text>
              <Text style={[styles.cellBold, { width: W.net, color: COLORS.accentDark }]}>{c ? c.net : ""}</Text>
            </View>
          ))}
          <Text style={[styles.cellFixed, { width: W.totalDyb }]}>{r.totalCorrect}</Text>
          <Text style={[styles.cellFixed, { width: W.totalDyb }]}>{r.totalWrong}</Text>
          <Text style={[styles.cellMuted, { width: W.totalDyb }]}>{r.totalBlank}</Text>
          <Text style={[styles.cellBold, { width: W.totalNet, color: COLORS.accentDark, fontSize: 6.3 }]}>{r.totalNet}</Text>
          <Text style={[styles.rankCell, { width: W.rank, color: r.rank <= 3 ? COLORS.gold : COLORS.text }]}>{r.rank}</Text>
          <Text style={[styles.rankCell, { width: W.rank }]}>{r.branchRank}</Text>
          <Text style={[styles.rankCell, { width: W.rank }]}>{r.gradeRank}</Text>
          {hasEstimate && <Text style={[styles.cellMuted, { width: W.estimate }]}>{r.estimatedRanking?.toLocaleString("tr-TR") ?? "—"}</Text>}
        </View>
      ))}
    </View>
  );
}

export function PdfExamRanking({
  institutionName,
  logoUrl,
  examName,
  examDate,
  listTitle,
  columnGroups,
  rows,
  hasEstimate,
}: {
  institutionName: string;
  logoUrl?: string | null;
  examName: string;
  examDate: string;
  listTitle: string;
  columnGroups: RankingColumnGroup[];
  rows: RankingStudentRow[];
  hasEstimate: boolean;
}) {
  const nets = rows.map((r) => r.totalNet);
  const avg = nets.length > 0 ? Math.round((nets.reduce((a, b) => a + b, 0) / nets.length) * 100) / 100 : 0;

  const byRank = [...rows].sort((a, b) => a.rank - b.rank);
  const byName = [...rows].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "tr"));

  const Header = ({ subtitle }: { subtitle: string }) => (
    <>
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
          <Text style={styles.headerLabel}>{t(examDate)}</Text>
          <Text style={styles.headerValue}>{t(examName)}</Text>
        </View>
      </View>
      <View style={styles.summaryBar}>
        <View>
          <Text style={styles.summaryLabel}>{t("Katılımcı")}</Text>
          <Text style={styles.summaryValue}>{rows.length}</Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>{t("Ortalama Net")}</Text>
          <Text style={styles.summaryValue}>{avg}</Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>{t("En Yüksek Net")}</Text>
          <Text style={styles.summaryValue}>{nets.length > 0 ? Math.max(...nets) : 0}</Text>
        </View>
      </View>
      <View style={styles.pageTitleBand}>
        <Text style={styles.pageTitle}>{t(`${listTitle.toUpperCase()} — ${subtitle.toUpperCase()}`)}</Text>
      </View>
    </>
  );

  return (
    <Document title={t(`${examName} - ${listTitle}`)}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <Header subtitle="Puan Sıralı Liste" />
        <View style={styles.body}>
          <DataTable columnGroups={columnGroups} rows={byRank} hasEstimate={hasEstimate} />
        </View>
        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")} · {t(new Date().toLocaleDateString("tr-TR"))}
        </Text>
      </Page>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <Header subtitle="İsim Sıralı Liste" />
        <View style={styles.body}>
          <DataTable columnGroups={columnGroups} rows={byName} hasEstimate={hasEstimate} />
        </View>
        <Text style={styles.footer} fixed>
          {t("Routinix Kampüs — Ölçme Değerlendirme")}
        </Text>
      </Page>
    </Document>
  );
}
