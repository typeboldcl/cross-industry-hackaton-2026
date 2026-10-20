import type { Completion, CompletionRequest, LlmClient } from "./llm-client.js";

export class FakeLlm implements LlmClient {
  readonly requests: CompletionRequest[] = [];

  constructor(
    private readonly respond: (request: CompletionRequest) => unknown,
  ) {}

  async complete(request: CompletionRequest): Promise<Completion> {
    this.requests.push(request);
    const answer = this.respond(request);
    return {
      content: typeof answer === "string" ? answer : JSON.stringify(answer),
      tokensIn: 10,
      tokensOut: 10,
    };
  }
}
