import OpenAI from "openai";

async function callGeminiDirect(systemPrompt: string, userPrompt: string): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const directAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await directAi.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: { systemInstruction: systemPrompt, maxOutputTokens: 8192 },
  });
  return response.text ?? "";
}

async function callGeminiReplit(systemPrompt: string, userPrompt: string): Promise<string> {
  const { ai } = await import("@workspace/integrations-gemini-ai");
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: { systemInstruction: systemPrompt, maxOutputTokens: 8192 },
  });
  return response.text ?? "";
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGeminiDirect(systemPrompt, userPrompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
      if (!isQuota) throw err;
      console.warn("[aiProvider] GEMINI_API_KEY com cota esgotada, tentando fallback...");
    }
  }

  if (process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
    return await callGeminiReplit(systemPrompt, userPrompt);
  }

  throw new Error("Nenhum provedor Gemini disponível");
}

function getServerOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (key && key.trim().startsWith("sk-")) {
    return new OpenAI({ apiKey: key.trim() });
  }
  return null;
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
      console.warn("[aiProvider] Gemini falhou, usando OpenAI:", msg);
    }
  }

  const serverClient = getServerOpenAIClient();
  if (serverClient) {
    return callOpenAI(serverClient, systemPrompt, userPrompt, maxTokens, "gpt-4o-mini");
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

  if (!usingUserKey) {
    try {
      return await callGemini(systemPrompt, userPrompt);
    } catch {
    }
    const serverClient = getServerOpenAIClient();
    if (serverClient) {
      return callOpenAI(serverClient, systemPrompt, userPrompt, maxTokens, model);
    }
  }

  return callOpenAI(client, systemPrompt, userPrompt, maxTokens, model);
}
