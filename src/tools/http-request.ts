import type { Tool, ToolResult } from './types.js';

export const httpRequestTool: Tool = {
  name: 'http_request',
  description:
    'Make an HTTP request with full control over method, headers, body, and auth — equivalent to curl. ' +
    'Use this for APIs, webhooks, POST/PUT/DELETE requests, and anything web_fetch cannot do.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to request',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        description: 'HTTP method (default: GET, or POST if body/json/form is set)',
      },
      headers: {
        type: 'object',
        description: 'Request headers as key-value pairs. e.g. {"Authorization": "Bearer TOKEN"}',
        additionalProperties: { type: 'string' },
      },
      body: {
        type: 'string',
        description: 'Raw request body string',
      },
      json: {
        type: 'object',
        description: 'JSON body — automatically sets Content-Type: application/json',
      },
      form: {
        type: 'object',
        description: 'Form data — sets Content-Type: application/x-www-form-urlencoded',
        additionalProperties: { type: 'string' },
      },
      auth: {
        type: 'string',
        description: 'Auth shorthand. "Bearer <token>" for Bearer auth, "user:pass" for Basic auth',
      },
      include_headers: {
        type: 'boolean',
        description: 'Include response status line and headers in output (default: false)',
      },
      raw: {
        type: 'boolean',
        description: 'Return raw response body without any content processing (default: false)',
      },
      follow_redirects: {
        type: 'boolean',
        description: 'Follow HTTP redirects (default: true)',
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds (default: 30000)',
      },
      max_length: {
        type: 'number',
        description: 'Maximum response body characters to return (default: 50000)',
      },
    },
    required: ['url'],
  },

  async execute(input): Promise<ToolResult> {
    const url            = input['url'] as string;
    const headersInput   = (input['headers'] as Record<string, string> | undefined) ?? {};
    const bodyStr        = input['body'] as string | undefined;
    const jsonBody       = input['json'] as Record<string, unknown> | undefined;
    const formBody       = input['form'] as Record<string, string> | undefined;
    const auth           = input['auth'] as string | undefined;
    const includeHeaders = (input['include_headers'] as boolean | undefined) ?? false;
    const raw            = (input['raw'] as boolean | undefined) ?? false;
    const timeout        = (input['timeout'] as number | undefined) ?? 30000;
    const maxLength      = (input['max_length'] as number | undefined) ?? 50000;
    const followRedirects = (input['follow_redirects'] as boolean | undefined) ?? true;

    // Determine method
    const hasBody = bodyStr !== undefined || jsonBody !== undefined || formBody !== undefined;
    const method = ((input['method'] as string | undefined) ?? (hasBody ? 'POST' : 'GET')).toUpperCase();

    // Build headers
    const headers: Record<string, string> = {
      'User-Agent': 'Manthra/0.1',
      ...headersInput,
    };

    // Auth header
    if (auth) {
      if (auth.toLowerCase().startsWith('bearer ')) {
        headers['Authorization'] = auth;
      } else if (auth.includes(':')) {
        headers['Authorization'] = 'Basic ' + Buffer.from(auth).toString('base64');
      } else {
        headers['Authorization'] = `Bearer ${auth}`;
      }
    }

    // Build body
    let requestBody: string | undefined;
    if (jsonBody !== undefined) {
      requestBody = JSON.stringify(jsonBody);
      headers['Content-Type'] ??= 'application/json';
    } else if (formBody !== undefined) {
      requestBody = new URLSearchParams(formBody).toString();
      headers['Content-Type'] ??= 'application/x-www-form-urlencoded';
    } else if (bodyStr !== undefined) {
      requestBody = bodyStr;
    }

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: requestBody,
        redirect: followRedirects ? 'follow' : 'manual',
        signal: AbortSignal.timeout(timeout),
      });

      const contentType = res.headers.get('content-type') ?? '';
      const status      = res.status;
      const statusText  = res.statusText;

      // Build response header block
      let headerBlock = '';
      if (includeHeaders) {
        headerBlock = `HTTP ${status} ${statusText}\n`;
        res.headers.forEach((value, key) => {
          headerBlock += `${key}: ${value}\n`;
        });
        headerBlock += '\n';
      }

      // Read body
      let responseBody: string;
      if (method === 'HEAD') {
        responseBody = '';
      } else if (
        !raw &&
        !contentType.includes('text') &&
        !contentType.includes('json') &&
        !contentType.includes('xml') &&
        !contentType.includes('javascript') &&
        !contentType.includes('form')
      ) {
        responseBody = `[Binary content: ${contentType}]`;
      } else {
        responseBody = await res.text();

        // Auto-format JSON for readability
        if (!raw && contentType.includes('json')) {
          try {
            const parsed = JSON.parse(responseBody);
            responseBody = JSON.stringify(parsed, null, 2);
          } catch {}
        }

        // Strip HTML tags unless raw mode
        if (!raw && contentType.includes('html')) {
          responseBody = responseBody
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }
      }

      // Truncate
      const truncated = responseBody.length > maxLength;
      if (truncated) {
        responseBody = responseBody.slice(0, maxLength) + `\n\n... (truncated at ${maxLength} chars)`;
      }

      const fullOutput = headerBlock + responseBody;

      if (!res.ok && status >= 400) {
        return {
          success: false,
          output: fullOutput,
          error: `HTTP ${status}: ${statusText}`,
        };
      }

      return { success: true, output: fullOutput || `HTTP ${status} ${statusText} (empty body)` };
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes('TimeoutError') || msg.includes('timed out')) {
        return { success: false, output: '', error: `Request timed out after ${timeout}ms` };
      }
      return { success: false, output: '', error: msg };
    }
  },
};
