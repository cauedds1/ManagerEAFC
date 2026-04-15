import OpenAI from "openai";
import { ai } from "@workspace/integrations-gemini-ai";

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192,
    },
  });
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
