import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type { z } from "zod";
import { ENV, type Env } from "../common/config/env.js";
import { canonicalJson, sha256Hex } from "./canonical-json.js";
import {
  ExtractionRunEntity,
  type ExtractionRunKind,
} from "./entities/extraction-run.entity.js";
import { type ChatMessage, LLM_CLIENT, type LlmClient } from "./llm-client.js";
import { Semaphore } from "./semaphore.js";

export interface LlmRunRequest<T> {
  kind: ExtractionRunKind;
  model: string;
  promptVersion: string;
  system: string;
  user: string;
  input: unknown;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface LlmRunResult<T> {
  runId: string;
  output: T;
  cached: boolean;
}

export class LlmOutputError extends Error {}

const DEFAULT_MAX_TOKENS = 8_000;

@Injectable()
export class LlmService {
  private readonly logger = new Logger("Llm");
  private readonly semaphore: Semaphore;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(LLM_CLIENT) private readonly client: LlmClient,
    @InjectRepository(ExtractionRunEntity)
    private readonly runs: Repository<ExtractionRunEntity>,
  ) {
    this.semaphore = new Semaphore(env.llm.concurrency);
  }

  static fingerprint(request: {
    kind: ExtractionRunKind;
    model: string;
    promptVersion: string;
    input: unknown;
  }): string {
    return sha256Hex(
      canonicalJson({
        kind: request.kind,
        model: request.model,
        promptVersion: request.promptVersion,
        input: request.input,
      }),
    );
  }

  async run<T>(request: LlmRunRequest<T>): Promise<LlmRunResult<T>> {
    const inputFingerprint = LlmService.fingerprint(request);
    const cached = await this.runs.findOneBy({ inputFingerprint });

    if (cached) {
      return {
        runId: cached.id,
        output: request.schema.parse(cached.output),
        cached: true,
      };
    }

    const { output, tokensIn, tokensOut } = await this.semaphore.run(() =>
      this.callWithCorrection(request),
    );

    const saved = await this.runs
      .createQueryBuilder()
      .insert()
      .values({
        kind: request.kind,
        model: request.model,
        promptVersion: request.promptVersion,
        inputFingerprint,
        input: request.input as object,
        output: output as object,
        tokensIn,
        tokensOut,
        costUsd: null,
      })
      .orIgnore()
      .returning(["id"])
      .execute();

    const runId =
      (saved.identifiers[0]?.id as string | undefined) ??
      (await this.runs.findOneByOrFail({ inputFingerprint })).id;

    return { runId, output, cached: false };
  }

  private async callWithCorrection<T>(request: LlmRunRequest<T>) {
    const messages: ChatMessage[] = [
      { role: "system", content: request.system },
      { role: "user", content: request.user },
    ];
    let tokensIn = 0;
    let tokensOut = 0;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await this.client.complete({
        model: request.model,
        messages,
        maxTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      });
      tokensIn += completion.tokensIn ?? 0;
      tokensOut += completion.tokensOut ?? 0;

      const parsed = parseJsonOutput(completion.content, request.schema);
      if (parsed.success) {
        return { output: parsed.data, tokensIn, tokensOut };
      }

      this.logger.warn(
        `${request.kind} output rejected (attempt ${attempt}): ${parsed.error}`,
      );
      messages.push(
        { role: "assistant", content: completion.content },
        {
          role: "user",
          content: `That answer is invalid: ${parsed.error}. Reply again with only the corrected JSON object.`,
        },
      );
    }

    throw new LlmOutputError(
      `${request.kind} returned invalid JSON twice for model ${request.model}.`,
    );
  }
}

export function parseJsonOutput<T>(
  content: string,
  schema: z.ZodType<T>,
): { success: true; data: T } | { success: false; error: string } {
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let json: unknown;
  try {
    json = JSON.parse(unfenced);
  } catch (error) {
    return {
      success: false,
      error: `not valid JSON (${error instanceof Error ? error.message : String(error)})`,
    };
  }

  const result = schema.safeParse(json);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error.message.slice(0, 1_000) };
}
