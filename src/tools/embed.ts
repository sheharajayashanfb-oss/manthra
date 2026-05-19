import type { Tool, ToolResult } from './types.js';
import { getProvider } from '../providers/registry.js';

// Tool that generates vector embeddings via Ollama's /api/embed
export const embedTool: Tool = {
  name: 'generate_embeddings',
  description: 'Generate vector embeddings for text using an Ollama embedding model',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to embed (single string or JSON array of strings)' },
      model: { type: 'string', description: 'Embedding model to use (e.g. embeddinggemma, all-minilm, qwen3-embedding). Defaults to all-minilm.' },
    },
    required: ['text'],
  },
  async execute(input): Promise<ToolResult> {
    const text = String(input['text']);
    const model = String(input['model'] ?? 'all-minilm');

    // Parse text — if it's a JSON array, treat as batch
    let textInput: string | string[];
    try {
      const parsed = JSON.parse(text);
      textInput = Array.isArray(parsed) ? parsed : text;
    } catch {
      textInput = text;
    }

    try {
      // Get the active provider and call embed
      const provider = getProvider('ollama') ?? getProvider('local');
      if (!provider || !('embed' in provider) || typeof (provider as unknown as Record<string, unknown>)['embed'] !== 'function') {
        // Fallback: call Ollama directly
        const baseURL = 'http://127.0.0.1:11434';
        const res = await fetch(`${baseURL}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: textInput }),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { embeddings: number[][] };
        const embeddings = data.embeddings;
        const summary = embeddings.map((e, i) => `[${i}] ${e.length}-dim vector, first 5: [${e.slice(0, 5).map((v) => v.toFixed(4)).join(', ')}...]`).join('\n');
        return { success: true, output: `Generated ${embeddings.length} embedding(s) with model "${model}":\n${summary}` };
      }

      const embedFn = (provider as { embed: (model: string, input: string | string[]) => Promise<number[][]> }).embed;
      const embeddings = await embedFn.call(provider, model, textInput);
      const summary = embeddings.map((e, i) => `[${i}] ${e.length}-dim vector, first 5: [${e.slice(0, 5).map((v) => v.toFixed(4)).join(', ')}...]`).join('\n');
      return { success: true, output: `Generated ${embeddings.length} embedding(s) with model "${model}":\n${summary}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

export const embedTools: Tool[] = [embedTool];
