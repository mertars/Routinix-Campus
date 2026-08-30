import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from "@/lib/server/pdf/fonts";
import { turkishSafe } from "@/lib/server/pdf/turkish-text";

ensurePdfFontsRegistered();

// bkz. diğer 6 PDF tasarımı — bu YEDİNCİSİ BİLEREK dekoratif DEĞİL: bu
// belge basılıp üzerine yazılacak bir çalışma kağıdı, "uygulama ekranı"
// hissi vermemeli. Klasik dershane test kağıdı estetiği: düz beyaz, ince
// çerçeveler, bol boşluk. Çözümler/kazanımlar BİLEREK yok — cevap
// anahtarı sadece uygulama içinde (öğrenci kendi test edip görsün diye).
const COLORS = { text: "#1F2937", textMuted: "#6B7280", hairline: "#D1D5DB", optionBorder: "#9CA3AF" };

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, backgroundColor: "#FFFFFF", color: COLORS.text, padding: 40, fontSize: 10 },
  header: { borderBottomWidth: 1.5, borderBottomColor: COLORS.text, paddingBottom: 10, marginBottom: 18 },
  title: { fontSize: 14, fontWeight: "bold" },
  subtitle: { fontSize: 9, color: COLORS.textMuted, marginTop: 2 },
  nameLine: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  nameLineField: { fontSize: 9, color: COLORS.textMuted },

  questionBlock: { marginBottom: 20 },
  questionHeader: { flexDirection: "row", marginBottom: 6 },
  questionNumber: { width: 20, fontSize: 10, fontWeight: "bold" },
  questionPrompt: { flex: 1, fontSize: 10, lineHeight: 1.4 },

  optionsGrid: { flexDirection: "row", flexWrap: "wrap", marginLeft: 20, gap: 10 },
  optionRow: { flexDirection: "row", alignItems: "center", width: "45%", marginBottom: 6 },
  optionBullet: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: COLORS.optionBorder, marginRight: 6 },
  optionText: { fontSize: 9.5 },

  answerLines: { marginLeft: 20, marginTop: 4 },
  answerLine: { height: 18, borderBottomWidth: 0.75, borderBottomColor: COLORS.hairline },

  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 7, color: COLORS.textMuted },
});

export type PdfPracticeWorksheetQuestion = { format: "OPEN_ENDED" | "MULTIPLE_CHOICE"; prompt: string; options: string[] };

export type PdfPracticeWorksheetProps = {
  topicName: string;
  subject: string;
  questions: PdfPracticeWorksheetQuestion[];
};

function t(value: string): string {
  return turkishSafe(value);
}

export function PdfPracticeWorksheet({ topicName, subject, questions }: PdfPracticeWorksheetProps) {
  return (
    <Document title={t(`${topicName} - Calisma Yapragi`)}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.title}>{t(`${subject} — ${topicName}`)}</Text>
          <Text style={styles.subtitle}>{t("Konu Bilgisi Çalışma Yaprağı")}</Text>
          <View style={styles.nameLine}>
            <Text style={styles.nameLineField}>{t("Ad Soyad: ______________________")}</Text>
            <Text style={styles.nameLineField}>{t("Tarih: ___/___/______")}</Text>
          </View>
        </View>

        {questions.map((q, index) => (
          <View key={index} style={styles.questionBlock} wrap={false}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionNumber}>{`${index + 1}.`}</Text>
              <Text style={styles.questionPrompt}>{t(q.prompt)}</Text>
            </View>
            {q.format === "MULTIPLE_CHOICE" ? (
              <View style={styles.optionsGrid}>
                {q.options.map((option, optionIndex) => (
                  <View key={optionIndex} style={styles.optionRow}>
                    <View style={styles.optionBullet} />
                    <Text style={styles.optionText}>{t(option)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.answerLines}>
                <View style={styles.answerLine} />
                <View style={styles.answerLine} />
              </View>
            )}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          {t("Powered by Routinix Kampüs")}
        </Text>
      </Page>
    </Document>
  );
}
