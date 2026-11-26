import { InvoiceAiConfig } from '../../platform/server-config';
import { DraftLine, emptyDraft, field, InvoiceDraft, draftFromAiJson } from './ingestion.types';
import { ImportKind } from './ingestion.types';

export interface ExtractInput {
  buffer: Buffer;
  contentType: string;
  kind: ImportKind;
}

export interface InvoiceAiProvider {
  readonly name: string;
  extract(input: ExtractInput): Promise<InvoiceDraft>;
}

/**
 * Deterministic synthetic extractor for local development, CI, and verification. It never touches the
 * network and never reads real invoice bytes, so no private supplier data leaves the machine. It
 * intentionally emits some below-threshold fields so the trader-review gate is exercised.
 */
export class SampleProvider implements InvoiceAiProvider {
  readonly name = 'sample';
  async extract({ kind }: ExtractInput): Promise<InvoiceDraft> {
    const draft = emptyDraft();
    if (kind === 'expense') {
      draft.header.amount = field(100.5, 0.92, 'sample');
      draft.header.currency = field('USD', 0.9, 'sample');
      draft.header.expenseDate = field('2026-01-15', 0.5, 'sample'); // low → needs review
      draft.header.categoryName = field('transport', 0.55, 'sample'); // low → needs review
      return draft;
    }
    draft.header.supplierName = field('Sample Supplier Co', 0.93, 'sample');
    draft.header.customerName = field('Sample Customer', 0.9, 'sample');
    draft.header.orderDate = field('2026-01-10', 0.5, 'sample'); // low → needs review
    draft.header.currency = field('USD', 0.95, 'sample');
    draft.header.totalAmount = field(2880, 0.9, 'sample');
    draft.lines = [
      sampleLine('Sample Product A', 'BrandX', 'L', 10, 24, 10, 2400, 1.5, 0.9),
      sampleLine('Sample Product B', 'BrandY', 'M', 5, 12, 8, 480, 0.6, 0.4), // low → needs review
    ];
    return draft;
  }
}

function sampleLine(
  description: string, brand: string, size: string, cartons: number, qtyPerCarton: number,
  unitPrice: number, amount: number, cbm: number, conf: number,
): DraftLine {
  return {
    description: field(description, conf, 'sample'),
    brand: field(brand, conf, 'sample'),
    size: field(size, conf, 'sample'),
    cartons: field(cartons, conf, 'sample'),
    qtyPerCarton: field(qtyPerCarton, conf, 'sample'),
    unitPrice: field(unitPrice, conf, 'sample'),
    amount: field(amount, conf, 'sample'),
    cbm: field(cbm, conf, 'sample'),
    productId: null,
  };
}

const PROMPT = `Extract this invoice into strict JSON only, no prose. Shape:
{"header":{"supplier","customer","orderDate","currency","total","deposit","freight","amount","expenseDate","category"},
 "lines":[{"description","brand","size","cartons","qtyPerCarton","unitPrice","amount","cbm"}]}
Use null for anything not present. Read Chinese, English, and Arabic. Do not invent values.`;

/** Shared OpenAI-compatible vision call used by both DeepSeek (international) and Qwen (mainland). */
async function openAiVisionExtract(
  cfg: InvoiceAiConfig, providerName: string, input: ExtractInput,
): Promise<InvoiceDraft> {
  if (!cfg.apiKey) throw new Error(`${providerName} extraction is not configured: missing API key`);
  if (!cfg.baseUrl) throw new Error(`${providerName} extraction is not configured: missing base URL`);
  if (!cfg.model) throw new Error(`${providerName} extraction is not configured: missing model`);
  const dataUrl = `data:${input.contentType};base64,${input.buffer.toString('base64')}`;
  const body = {
    model: cfg.model,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: PROMPT },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }],
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${providerName} provider returned HTTP ${res.status}`);
    const json = await res.json() as any;
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    return draftFromAiJson(parseJsonLoose(text), providerName);
  } finally {
    clearTimeout(timer);
  }
}

export class DeepSeekProvider implements InvoiceAiProvider {
  readonly name = 'deepseek';
  constructor(private readonly cfg: InvoiceAiConfig) {}
  extract(input: ExtractInput) { return openAiVisionExtract(this.cfg, 'deepseek', input); }
}

export class QwenProvider implements InvoiceAiProvider {
  readonly name = 'qwen';
  constructor(private readonly cfg: InvoiceAiConfig) {}
  extract(input: ExtractInput) { return openAiVisionExtract(this.cfg, 'qwen', input); }
}

export class NoneProvider implements InvoiceAiProvider {
  readonly name = 'none';
  async extract(): Promise<InvoiceDraft> {
    throw new Error('Invoice AI extraction is disabled (INVOICE_AI_PROVIDER=none)');
  }
}

export function getProvider(cfg: InvoiceAiConfig): InvoiceAiProvider {
  switch (cfg.provider) {
    case 'sample': return new SampleProvider();
    case 'deepseek': return new DeepSeekProvider(cfg);
    case 'qwen': return new QwenProvider(cfg);
    default: return new NoneProvider();
  }
}

/** Parses a JSON object from a model reply that may wrap it in prose or code fences. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = (text ?? '').trim();
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const fenced = trimmed.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(fenced); } catch { /* fall through */ }
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(fenced.slice(start, end + 1)); } catch { /* give up */ }
  }
  return null;
}
