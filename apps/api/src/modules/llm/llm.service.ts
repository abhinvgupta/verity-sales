import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

const MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 2000;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI;

  constructor(configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  /** Sends a single-shot text prompt to OpenAI and returns the raw text response.
   *  Uses JSON response format to enforce valid JSON output. */
  async complete(prompt: string, maxTokens = DEFAULT_MAX_TOKENS): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? '';
    this.logger.log(`LLM responded (${text.length} chars)`);
    return text;
  }

  /**
   * Streams a single-shot text prompt, invoking `onDelta` per content chunk,
   * and resolves with the full concatenated text. Aborting `signal` cancels
   * the in-flight request (the promise then rejects with an abort error).
   */
  async completeStream(
    prompt: string,
    options: {
      maxTokens?: number;
      signal?: AbortSignal;
      onDelta?: (text: string) => void;
    } = {},
  ): Promise<string> {
    const stream = await this.client.chat.completions.create(
      {
        model: MODEL,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        response_format: { type: 'json_object' },
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: options.signal },
    );

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        options.onDelta?.(delta);
      }
    }
    this.logger.log(`LLM stream finished (${full.length} chars)`);
    return full;
  }

  /** Sends a prompt plus an image (by URL) to gpt-4o vision and returns the raw
   *  text response. Used to extract structured data from a scanned form image. */
  async completeWithImage(
    prompt: string,
    imageUrl: string,
    maxTokens = DEFAULT_MAX_TOKENS,
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    this.logger.log(`Vision LLM responded (${text.length} chars)`);
    return text;
  }
}
