import OpenAI from "openai";

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const GEMINI_MODEL = "gemini-2.0-flash";
  const params = {
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: { systemInstruction: systemPrompt, maxOutputTokens: 8192 },
  };

  if (process.env.GEMINI_API_KEY) {
    const { GoogleGenAI } = await import("@google/genai");
    const directAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await directAi.models.generateContent(params);
    return response.text ?? "";
  }

  const { ai } = await import("@workspace/integrations-gemini-ai");
  const response = await ai.models.generateContent(params);
  return response.text ?? "";
}

async function callOpenAI(
  client: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  model: string,
): Promise<string> {
  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    stream: false,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  } as Parameters<typeof client.chat.completions.create>[0]);
  return (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";
}

export async function callNewsCompletion(
  client: OpenAI,
  usingUserKey: boolean,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096,
): Promise<string> {
  if (usingUserKey) {
    return callOpenAI(client, systemPrompt, userPrompt, maxTokens, "gpt-4o");
  }

  const useGemini = Math.random() < 0.7;
  if (useGemini) {
    try {
      return await callGemini(systemPrompt, userPrompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[aiProvider] Gemini falhou, usando gpt-4o-mini:", msg);
    }
  }

  return callOpenAI(client, systemPrompt, userPrompt, maxTokens, "gpt-4o-mini");
}

export async function callDiretoriaCompletion(
  client: OpenAI,
  usingUserKey: boolean,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
): Promise<string> {
  const model = usingUserKey ? "gpt-4o" : "gpt-4o-mini";
  return callOpenAI(client, systemPrompt, userPrompt, maxTokens, model);
}
