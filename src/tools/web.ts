import type { Tool, ToolResult } from './types.js';

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Replace block-level tags with newlines
  text = text
    .replace(/<\/?(div|p|br|h[1-6]|li|tr|td|th|section|article|header|footer|nav|main|aside)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ''); // strip remaining tags

  // Decode common HTML entities
  text = text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

async function fetchText(url: string, maxChars = 10000): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Manthra/1.0)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const raw = await response.text();

  if (contentType.includes('text/html')) {
    const stripped = stripHtml(raw);
    return stripped.slice(0, maxChars);
  }

  return raw.slice(0, maxChars);
}

const webFetchTool: Tool = {
  name: 'web_fetch',
  description: 'Fetch the content of a URL and return readable text (HTML stripped)',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    required: ['url'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const url = String(input['url']);
      const apiKey = process.env['OLLAMA_API_KEY'];

      if (apiKey) {
        try {
          const res = await fetch('https://ollama.com/api/web_fetch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ url }),
            signal: AbortSignal.timeout(15000),
          });
          if (res.ok) {
            const data = await res.json() as { content?: string; title?: string };
            return { success: true, output: `${data.title ? data.title + '\n\n' : ''}${data.content ?? ''}` };
          }
        } catch { /* fall through to direct fetch */ }
      }

      const content = await fetchText(url);
      return { success: true, output: content };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web using DuckDuckGo and return top results',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
    },
    required: ['query'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const query = String(input['query']);
      const apiKey = process.env['OLLAMA_API_KEY'];

      if (apiKey) {
        try {
          const res = await fetch('https://ollama.com/api/web_search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ query, max_results: 8 }),
            signal: AbortSignal.timeout(15000),
          });
          if (res.ok) {
            const data = await res.json() as { results?: Array<{ title: string; url: string; content: string }> };
            const results = (data.results ?? []).map((r, i) =>
              `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`
            );
            return { success: true, output: `Search results for "${query}":\n\n${results.join('\n\n')}` };
          }
        } catch { /* fall through to DuckDuckGo */ }
      }

      // DuckDuckGo fallback
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const html = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Manthra/1.0)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15000),
      }).then((r) => r.text());

      // Extract result titles and snippets using regex
      const results: string[] = [];

      // Match DuckDuckGo result links and snippets
      const linkPattern = /class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/g;
      const snippetPattern = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      const links: Array<{ url: string; title: string }> = [];
      let m;
      while ((m = linkPattern.exec(html)) !== null && links.length < 10) {
        const rawUrl = m[1];
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        // DuckDuckGo uses redirect URLs, extract actual URL
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        const actualUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawUrl;
        if (title && actualUrl && !actualUrl.includes('duckduckgo.com')) {
          links.push({ url: actualUrl, title });
        }
      }

      const snippets: string[] = [];
      while ((m = snippetPattern.exec(html)) !== null && snippets.length < 10) {
        const snippet = m[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
        if (snippet) snippets.push(snippet);
      }

      for (let i = 0; i < Math.min(links.length, 8); i++) {
        const link = links[i];
        const snippet = snippets[i] ?? '';
        results.push(`${i + 1}. ${link!.title}\n   ${link!.url}\n   ${snippet}`);
      }

      if (results.length === 0) {
        return { success: true, output: `No results found for: ${query}` };
      }

      return { success: true, output: `Search results for "${query}":\n\n${results.join('\n\n')}` };
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const docsSearchTool: Tool = {
  name: 'docs_search',
  description: 'Search documentation for a specific library or framework',
  parameters: {
    type: 'object',
    properties: {
      library: { type: 'string', description: 'The library or framework name (e.g., "React", "Express", "Python")' },
      query: { type: 'string', description: 'What to search for in the docs' },
    },
    required: ['library', 'query'],
  },
  async execute(input): Promise<ToolResult> {
    const library = String(input['library']);
    const query = String(input['query']);
    // Delegate to web_search with a library-specific query
    return webSearchTool.execute({ query: `${library} documentation ${query}` });
  },
};

export const webTools: Tool[] = [webFetchTool, webSearchTool, docsSearchTool];
