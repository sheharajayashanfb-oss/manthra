import type { Tool, ToolResult } from './types.js';

export const webFetchTool: Tool = {
  name: 'web_fetch',
  description: 'Fetch content from a URL. Returns the text content of the page.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
      max_length: { type: 'number', description: 'Maximum characters to return (default: 20000)' },
    },
    required: ['url'],
  },
  async execute(input): Promise<ToolResult> {
    const url = input['url'] as string;
    const maxLength = (input['max_length'] as number | undefined) ?? 20000;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Manthra/0.1 (AI coding assistant)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return { success: false, output: '', error: `HTTP ${res.status}: ${res.statusText}` };
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text') && !contentType.includes('json')) {
        return { success: false, output: '', error: `Unsupported content type: ${contentType}` };
      }
      let text = await res.text();
      // Strip HTML tags for cleaner output
      if (contentType.includes('html')) {
        text = text
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
      }
      if (text.length > maxLength) {
        text = text.slice(0, maxLength) + `\n... (truncated at ${maxLength} chars)`;
      }
      return { success: true, output: text };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
