export type LlmProviderType = "gemini" | "openai-compatible";

export interface LlmStatus {
  provider: LlmProviderType;
  model: string;
  baseUrl?: string;
  configured: boolean;
}

export interface OpenAIToolDeclaration {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export function getLlmStatus(): LlmStatus {
  const explicitProvider = process.env.LLM_PROVIDER?.toLowerCase();
  const hasBaseUrl = Boolean(process.env.LLM_BASE_URL?.trim());

  if (explicitProvider === "openai-compatible" || (!explicitProvider && hasBaseUrl && !process.env.GEMINI_API_KEY)) {
    const baseUrl = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, "");
    const model = process.env.LLM_MODEL || "dolphin-llama3";
    return {
      provider: "openai-compatible",
      model,
      baseUrl,
      configured: Boolean(baseUrl && model),
    };
  }

  return {
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-4-hydrogen",
    configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
  };
}

export async function callOpenAICompatibleChat(params: {
  messages: OpenAIMessage[];
  tools?: OpenAIToolDeclaration[];
  temperature?: number;
}): Promise<{
  content: string;
  toolCalls: Array<{ id: string; name: string; args: Record<string, any> }>;
  rawMessage: OpenAIMessage;
}> {
  const status = getLlmStatus();
  const baseUrl = (status.baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY || "not-needed";

  const body: Record<string, any> = {
    model: status.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
  };

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
    body.tool_choice = "auto";
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI-compatible API error (${response.status}): ${errText}`);
  }

  const data: any = await response.json();
  const choice = data?.choices?.[0];
  const message = choice?.message || { role: "assistant", content: "" };

  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls.map((tc: any, idx: number) => {
        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs =
            typeof tc.function?.arguments === "string"
              ? JSON.parse(tc.function.arguments || "{}")
              : tc.function?.arguments || {};
        } catch {
          parsedArgs = {};
        }
        return {
          id: tc.id || `call_${Date.now()}_${idx}`,
          name: tc.function?.name || "unknown",
          args: parsedArgs,
        };
      })
    : [];

  return {
    content: typeof message.content === "string" ? message.content : "",
    toolCalls,
    rawMessage: message,
  };
}
