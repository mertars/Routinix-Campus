// Faz Z3 — soru havuzu üretim worker'ının AI istemcisi. QwenCloud "Token
// Plan" (kullanıcının haftalık 2500 kredi/18M token paketi — home.qwencloud.
// com/api-keys) OpenAI-uyumlu KENDİ base URL'ini kullanıyor — standart
// DashScope Pay-As-You-Go adresinden (dashscope-intl.aliyuncs.com) FARKLI,
// bu yüzden sabit kodlamak yerine env'den okunuyor (Pay-As-You-Go'ya
// geçilirse tek satır değişir). Ayrı bir SDK paketi eklemek yerine düz
// fetch ile standart Chat Completions REST şeması kullanılıyor.
//
// ⚠️ Bu modül SADECE scripts/xray-generate-question-pool.ts worker'ından
// çağrılır — Next.js sunucu sürecinin (getEnv() ile doğrulanan) zorunlu env
// şemasına KASITLI olarak dahil edilmedi, çünkü XRAY_QUESTION_GEN_API_KEY/
// XRAY_QUESTION_GEN_BASE_URL sadece yerel/arka plan worker'a ait, Vercel
// production boot'unu buna bağımlı kılmamak için ayrı okunuyor.
const DEFAULT_BASE_URL = "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";

export type ChatCompletionResult = {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export async function callChatCompletion(params: { model: string; systemPrompt: string; userPrompt: string; maxTokens: number }): Promise<ChatCompletionResult> {
  const apiKey = process.env.XRAY_QUESTION_GEN_API_KEY;
  if (!apiKey) throw new Error("XRAY_QUESTION_GEN_API_KEY tanımlı değil (.env.local kontrol et).");
  const baseUrl = process.env.XRAY_QUESTION_GEN_BASE_URL || DEFAULT_BASE_URL;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      max_tokens: params.maxTokens,
      temperature: 0.8,
      // ⚠️ KRİTİK: bu model varsayılan olarak "reasoning" (görünmeyen
      // zincir-halinde-düşünme) modunda çalışıyor — canlı testte 30 soruluk
      // bir tur için max_tokens'ın TAMAMINI (16000/16000) görünmeyen
      // reasoning_content'e harcayıp gerçek content'i HİÇ üretmeden
      // finish_reason:"length" ile kesiliyordu (content boş kalıyordu).
      // enable_thinking:false bunu tamamen kapatıyor — aynı istek finish_
      // reason:"stop" ile TAM içerik döndürüyor, üstelik ~2.4x daha az
      // token harcıyor (reasoning_tokens hiç sayılmıyor). Yapılandırılmış/
      // şablona bağlı bir JSON üretim görevi için görünür "düşünme"ye
      // ihtiyaç yok, sadece israf ediyordu.
      enable_thinking: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DashScope API hatası (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("DashScope yanıtında içerik yok.");

  return {
    content,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
  };
}

// Modelin ```json ... ``` gibi markdown çitleriyle sarması ihtimaline karşı
// savunmacı çıkarım — response_format:json_object desteği tüm DashScope
// modellerinde garanti olmadığı için buna güvenilmiyor, ham metinden ilk
// geçerli JSON dizisi/nesnesi çıkarılıyor.
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}
