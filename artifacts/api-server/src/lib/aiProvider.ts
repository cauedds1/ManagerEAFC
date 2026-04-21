import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

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

export async function callNewsWithPlan(
  plan: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096,
): Promise<string> {
  if (plan === "ultra") {
    const serverClient = getServerOpenAIClient();
    if (serverClient) {
      try {
        return await callOpenAI(serverClient, systemPrompt, userPrompt, maxTokens, "gpt-4o");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[aiProvider] GPT-4o falhou para Ultra, usando Gemini fallback:", msg);
      }
    }
  }

  try {
    return await callGemini(systemPrompt, userPrompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiProvider] Gemini falhou, usando OpenAI fallback:", msg);
  }

  const serverClient = getServerOpenAIClient();
  if (serverClient) {
    return callOpenAI(serverClient, systemPrompt, userPrompt, maxTokens, "gpt-4o-mini");
  }

  throw new Error("Nenhum provedor de IA disponível");
}

export async function callDiretoriaWithPlan(
  plan: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
): Promise<string> {
  if (plan === "ultra") {
    const serverClient = getServerOpenAIClient();
    if (serverClient) {
      try {
        return await callOpenAI(serverClient, systemPrompt, userPrompt, maxTokens, "gpt-4o");
      } catch {}
    }
  }

  try {
    return await callGemini(systemPrompt, userPrompt);
  } catch {}

  const serverClient = getServerOpenAIClient();
  if (serverClient) {
    return callOpenAI(serverClient, systemPrompt, userPrompt, maxTokens, "gpt-4o-mini");
  }

  throw new Error("Nenhum provedor de IA disponível");
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

  try {
    return await callGemini(systemPrompt, userPrompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiProvider] Gemini falhou, usando GPT-4o-mini:", msg);
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
  if (usingUserKey) {
    return callOpenAI(client, systemPrompt, userPrompt, maxTokens, "gpt-4o");
  }

  try {
    return await callGemini(systemPrompt, userPrompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[aiProvider] Gemini falhou, usando GPT-4o-mini:", msg);
  }

  const serverClient = getServerOpenAIClient();
  if (serverClient) {
    return callOpenAI(serverClient, systemPrompt, userPrompt, maxTokens, "gpt-4o-mini");
  }

  return callOpenAI(client, systemPrompt, userPrompt, maxTokens, "gpt-4o-mini");
}

async function callOpenAIMessages(
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
  maxTokens: number,
  model: string,
): Promise<string> {
  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    stream: false,
    messages,
  } as Parameters<typeof client.chat.completions.create>[0]);
  return (completion as OpenAI.Chat.Completions.ChatCompletion).choices[0]?.message?.content ?? "";
}

export async function callDiretoriaChatWithPlan(
  plan: string,
  messages: ChatCompletionMessageParam[],
  maxTokens = 1024,
): Promise<string> {
  if (plan === "ultra") {
    const serverClient = getServerOpenAIClient();
    if (serverClient) {
      try {
        return await callOpenAIMessages(serverClient, messages, maxTokens, "gpt-4o");
      } catch {}
    }
  }

  const systemMsg = messages.find((m) => m.role === "system")?.content;
  const systemPrompt = typeof systemMsg === "string" ? systemMsg : "";
  const nonSystem = messages.filter((m) => m.role !== "system");
  const combinedUser = nonSystem
    .map((m) => {
      const role = m.role === "user" ? "Usuário" : "Assistente";
      const text = typeof m.content === "string" ? m.content : "";
      return `${role}: ${text}`;
    })
    .join("\n\n");

  try {
    return await callGemini(systemPrompt, combinedUser);
  } catch {}

  const serverClient = getServerOpenAIClient();
  if (serverClient) {
    return callOpenAIMessages(serverClient, messages, maxTokens, "gpt-4o-mini");
  }

  throw new Error("Nenhum provedor de IA disponível");
}
