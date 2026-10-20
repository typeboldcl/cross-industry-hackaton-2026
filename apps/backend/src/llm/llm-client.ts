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

  // Streaming keeps bytes flowing while the model reasons, so Orbit's gateway does not cut long calls with a 504.
  async complete(request: CompletionRequest): Promise<Completion> {
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      response_format: { type: "json_object" },
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = "";
    let tokensIn: number | null = null;
    let tokensOut: number | null = null;

    for await (const chunk of stream) {
      content += chunk.choices[0]?.delta?.content ?? "";
      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens;
        tokensOut = chunk.usage.completion_tokens;
      }
    }

    return { content, tokensIn, tokensOut };
  }
}
