/**
 * LLM Service — replaces base44.integrations.Core.InvokeLLM
 * Supports Gemini (default) and Anthropic Claude.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const geminiClient = config.geminiApiKey
  ? new GoogleGenerativeAI(config.geminiApiKey)
  : null;

const anthropicClient = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

type LLMModel = 'gemini_3_flash' | 'gemini_pro' | 'claude_sonnet_4_6' | 'claude_haiku';

interface InvokeLLMOptions {
  model?: LLMModel;
  prompt: string;
  response_json_schema?: Record<string, unknown>;
  maxTokens?: number;
}

export async function invokeLLM({ model = 'gemini_3_flash', prompt, response_json_schema, maxTokens }: InvokeLLMOptions): Promise<Record<string, unknown>> {
  if (model.startsWith('claude')) {
    return invokeClaude(model, prompt, response_json_schema, maxTokens);
  }
  return invokeGemini(model, prompt, response_json_schema, maxTokens);
}

// ── Gemini ────────────────────────────────────────────────────────────
async function invokeGemini(
  model: string,
  prompt: string,
  schema?: Record<string, unknown>,
  maxTokens?: number
): Promise<Record<string, unknown>> {
  if (!geminiClient) throw new Error('GEMINI_API_KEY not configured');

  const modelName = model === 'gemini_pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
  const genModel = geminiClient.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: maxTokens || 8192,
      responseMimeType: schema ? 'application/json' : undefined,
    },
  });

  const systemInstruction = schema
    ? 'You MUST respond with valid JSON matching the requested schema. No markdown, no code fences, no commentary.'
    : undefined;

  const result = await genModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemInstruction ? { systemInstruction: { role: 'model', parts: [{ text: systemInstruction }] } } : {}),
  });

  const text = result.response.text().trim();

  if (!text) throw new Error('Gemini returned empty response');

  try {
    const parsed = JSON.parse(text);
    return parsed as Record<string, unknown>;
  } catch {
    // If schema was expected but parse failed, try to extract JSON
    if (schema) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    }
    return { text };
  }
}

// ── Claude ────────────────────────────────────────────────────────────
async function invokeClaude(
  model: string,
  prompt: string,
  schema?: Record<string, unknown>,
  maxTokens?: number
): Promise<Record<string, unknown>> {
  if (!anthropicClient) throw new Error('ANTHROPIC_API_KEY not configured');

  const claudeModel = model === 'claude_haiku' ? 'claude-3-5-haiku-20241022' : 'claude-sonnet-4-6-20250514';

  const systemPrompt = schema
    ? 'You MUST respond with valid JSON matching the requested schema. No markdown, no code fences, no commentary. Return raw JSON only.'
    : '';

  const response = await anthropicClient.messages.create({
    model: claudeModel,
    max_tokens: maxTokens || 8192,
    system: systemPrompt || undefined,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('Claude returned no text');

  const text = textBlock.text.trim();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (schema) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    }
    return { text };
  }
}
