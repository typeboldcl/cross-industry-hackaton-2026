import OpenAI from "openai";
import type { LlmSettings } from "../common/config/env.js";

export const LLM_CLIENT = Symbol("LLM_CLIENT");

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
}

export interface Completion {
  content: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface LlmClient {
  complete(request: CompletionRequest): Promise<Completion>;
}

export class OrbitLlmClient implements LlmClient {
  private readonly client: OpenAI;

  constructor(settings: LlmSettings) {
    if (!settings.apiKey) {
      throw new Error("ORBIT_API_KEY is required to call the LLM.");
    }

    // The SDK already backs off on 429 and 5xx, honouring retry-after.
    this.client = new OpenAI({
      baseURL: settings.baseUrl,
      apiKey: settings.apiKey,
      timeout: settings.timeoutMs,
      maxRetries: 4,
    });
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      response_format: { type: "json_object" },
    });

    return {
      content: response.choices[0]?.message.content ?? "",
      tokensIn: response.usage?.prompt_tokens ?? null,
      tokensOut: response.usage?.completion_tokens ?? null,
    };
  }
}
