import type { Tool, ToolResult } from './types.js';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];

  // DuckDuckGo HTML result blocks: each result has .result__a (title+url) and .result__snippet
  const blockRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = match[1];
    const title = stripTags(match[2]);
    const snippet = stripTags(match[3]);

    // DuckDuckGo wraps real URLs in a redirect — decode it
    let finalUrl = rawUrl;
    const uddg = rawUrl.match(/uddg=([^&]+)/);
    if (uddg) {
      try { finalUrl = decodeURIComponent(uddg[1]); } catch { /* keep raw */ }
    }

    if (title && finalUrl && !finalUrl.startsWith('//duckduckgo.com')) {
      results.push({ title, url: finalUrl, snippet });
    }
  }

  return results;
}

export const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information. Returns titles, URLs, and snippets. Use when you need up-to-date information or documentation you don\'t have a URL for.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      max_results: { type: 'number', description: 'Maximum number of results (default: 8, max: 20)' },
    },
    required: ['query'],
  },
  async execute(input): Promise<ToolResult> {
    if (typeof input['query'] !== 'string' || !input['query']) {
      return { success: false, output: '', error: 'query is required and must be a string' };
    }

    const query = input['query'] as string;
    const maxResults = Math.min((input['max_results'] as number | undefined) ?? 8, 20);

    try {
      const results = await searchDuckDuckGo(query, maxResults);

      if (results.length === 0) {
        return { success: true, output: `No results found for: ${query}` };
      }

      const output = results
        .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`)
        .join('\n\n');

      return { success: true, output: `Search results for "${query}":\n\n${output}` };
    } catch (err: unknown) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
