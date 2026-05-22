import * as readline from 'readline';
import { PassThrough } from 'stream';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { spawnSync, execSync } from 'child_process';
import chalk from 'chalk';
import type { Provider, Message, ContentBlock, StreamEvent, ImageContent } from '../providers/types.js';
import { ConversationHistory } from '../conversation/index.js';
import { getConfig } from '../config/loader.js';
import { loadProviders, getProvider, getDefaultProvider } from '../providers/registry.js';
import { DEFAULT_SYSTEM_PROMPT } from '../config/defaults.js';
import { formatMemoryForContext } from '../memory/store.js';
import { getCommand, getAllCommands } from '../slash-commands/registry.js';
import type { CommandContext } from '../slash-commands/types.js';
import { formatMarkdown } from '../ui/renderer.js';
import { loadManthraMd } from '../config/manthra-md.js';
import { getToolDefinitions } from '../tools/registry.js';
import { executeTool } from '../tools/executor.js';
import { platformSystemPrompt } from '../tools/platform.js';

// ── Thinking animation ────────────────────────────────────────────────────────

const THINKING = [
  'Thinking', 'Reasoning', 'Processing', 'Analyzing', 'Reflecting', 'Pondering', 'Contemplating', 'Deliberating', 'Evaluating', 'Interpreting', 'Understanding', 'Figuring it out', 'Working it out', 'Breaking it down', 'Connecting ideas', 'Synthesizing', 'Formulating', 'Organizing thoughts', 'Reviewing', 'Rechecking', 'Brainstorming', 'Tinkering', 'Exploring', 'Digging in', 'Untangling', 'Decoding', 'Mapping it out', 'Piecing it together', 'Cooking up an answer', 'Sharpening logic', 'Structuring output', 'Building context', 'Scanning possibilities', 'Weighing options', 'Filtering noise', 'Optimizing reasoning', 'Searching patterns', 'Testing ideas', 'Simulating outcomes', 'Let me think', 'Let\'s see', 'Hmm', 'One moment', 'Almost there', 'Thinking through this', 'Working on it', 'Getting clarity', 'Putting it together', 'Double-checking', 'Stepping through it', 'Re-evaluating', 'Getting the details right', 'Holding that thought', 'Forming response', 'Constructing answer', 'Drafting logic', 'Aligning ideas', 'Sorting information', 'Processing inputs', 'Parsing meaning', 'Extracting insight', 'Reviewing data', 'Inspecting details', 'Examining closely', 'Looking deeper', 'Going deeper', 'Thinking deeper', 'Expanding thought', 'Narrowing focus', 'Clarifying intent', 'Inferring meaning', 'Drawing conclusions', 'Reassessing', 'Reconstructing logic', 'Rebuilding understanding', 'Checking assumptions', 'Validating idea', 'Confirming reasoning', 'Running analysis', 'Mental modeling', 'Cognitive processing', 'Pattern matching', 'Signal extraction', 'Noise reduction', 'Idea exploration', 'Thought formation', 'Logic building', 'Insight generation', 'Knowledge synthesis', 'Information structuring', 'Context building', 'Thought sequencing', 'Reasoning step-by-step', 'Breaking complexity', 'Simplifying structure', 'Organizing reasoning chain', 'Evaluating possibilities', 'Exploring angles', 'Considering options', 'Weighing evidence', 'Checking consistency', 'Testing logic', 'Verifying steps', 'Debugging thought process', 'Running mental simulation', 'Iterating reasoning', 'Refining answer', 'Improving clarity', 'Enhancing logic', 'Tightening explanation', 'Strengthening argument', 'Reworking idea', 'Adjusting reasoning', 'Fine-tuning output', 'Polishing thought', 'Finalizing reasoning', 'Almost ready', 'Nearly done', 'Getting there', 'Still thinking', 'Just a second', 'Give me a moment', 'Working through details', 'Sorting complexity', 'Handling nuance', 'Parsing context', 'Reading between lines', 'Understanding structure', 'Building response', 'Preparing answer', 'Assembling logic', 'Collecting thoughts', 'Gathering insight', 'Pulling information together', 'Organizing response', 'Structuring reply', 'Composing answer', 'Writing mentally', 'Forming explanation', 'Drafting response', 'Thinking aloud', 'Internal reasoning', 'Silent analysis', 'Deep processing', 'Fast reasoning', 'Slow careful thinking', 'Careful analysis', 'Quick evaluation', 'Rapid processing', 'Thorough examination', 'Light analysis', 'Heavy reasoning', 'Deep dive', 'Surface scan', 'Mental pass', 'Second pass analysis', 'Third pass review', 'Multi-step reasoning', 'Layered thinking', 'Hierarchical analysis', 'Sequential reasoning', 'Parallel thinking', 'Concept mapping', 'Idea linking', 'Knowledge traversal', 'Reasoning traversal', 'Cognitive scan', 'Analytical sweep', 'Insight sweep', 'Thought scan', 'Reasoning pass', 'Logic pass', 'Evaluation pass', 'Review pass', 'Check pass', 'Final pass', 'Initial thinking', 'First impression analysis', 'Early reasoning', 'Mid reasoning', 'Late stage thinking', 'Pre-finalizing', 'Post-processing', 'Pre-processing thought', 'Bootstrapping reasoning', 'Stabilizing answer', 'Converging on solution', 'Diverging ideas', 'Exploring branches', 'Pruning options', 'Selecting path', 'Decision forming', 'Judgment processing', 'Opinion forming', 'Insight crystallizing', 'Thought crystallization', 'Idea refinement', 'Signal interpretation', 'Context interpretation', 'Meaning extraction', 'Intent detection', 'Goal alignment', 'Response shaping', 'Output crafting', 'Answer shaping', 'Logic shaping', 'Reasoning shaping', 'Structuring insight', 'Organizing cognition', 'Mental structuring', 'Cognitive structuring', 'Thought architecture', 'Reasoning architecture', 'Building framework', 'Constructing framework', 'Framework analysis', 'System thinking', 'Holistic reasoning', 'Linear reasoning', 'Nonlinear reasoning', 'Abstract thinking', 'Concrete reasoning', 'Meta thinking', 'Self-checking logic', 'Recursive thinking', 'Iterative thinking', 'Continuous processing', 'Active reasoning', 'Passive analysis', 'Background thinking', 'Foreground reasoning', 'Focused thinking', 'Diffuse thinking', 'Expanding analysis', 'Compressing thought', 'Condensing reasoning', 'Elaborating idea', 'Summarizing mentally', 'Extracting core idea', 'Identifying key points', 'Highlighting relevance', 'Filtering importance', 'Ranking ideas', 'Prioritizing logic', 'Ordering thoughts', 'Sequencing ideas', 'Aligning reasoning', 'Harmonizing output', 'Stabilizing logic', 'Balancing arguments', 'Cross-checking', 'Multi-angle analysis', 'Perspective shifting', 'Context switching', 'Mental adjustment', 'Adaptive reasoning', 'Dynamic thinking', 'Fluid analysis', 'Structured reasoning', 'Unstructured exploration', 'Open-ended thinking', 'Goal-oriented reasoning', 'Task-focused thinking', 'Solution search', 'Answer search', 'Insight search', 'Meaning search', 'Logic search', 'Pattern search', 'Connection search', 'Deep inspection', 'Broad scan', 'Narrow focus', 'Zooming in', 'Zooming out', 'Perspective zoom', 'Detail checking', 'Macro analysis', 'Micro analysis', 'System scan', 'Cognitive load processing', 'Thought compression', 'Idea expansion', 'Reasoning expansion', 'Clarification pass', 'Final review', 'Pre-output check', 'Output validation', 'Response preparation', 'Answer finalization', 'Done thinking',
];
const SPIN = [
  '·',
  '○',
  '◔',
  '◑',
  '⬟',
  '✺',
  '⬟',
  '◑',
  '◔',
  '○',
  '·'
];

function startThinking(): () => void {
  if (!process.stdout.isTTY) return () => { };
  let si = 0;
  let mi = Math.floor(Math.random() * THINKING.length);
  let frame = 0;

  const tick = () => {
    process.stdout.write(
      `\r  ${chalk.cyan(SPIN[si % SPIN.length])} ${chalk.dim(THINKING[mi] + '…')}          `,
    );
    si++;
    if (++frame % 20 === 0) mi = (mi + 1) % THINKING.length;
  };

  tick();
  const timer = setInterval(tick, 100);

  return () => {
    clearInterval(timer);
    process.stdout.write('\r\x1B[2K');
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

function termCols(): number {
  return Math.min(process.stdout.columns ?? 80, 120);
}

function wrapText(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const result: string[] = [];
  const words = line.split(' ');
  let current = '';
  for (const word of words) {
    // Word itself is longer than width — hard-break it
    if (word.length >= width) {
      if (current) { result.push(current); current = ''; }
      for (let i = 0; i < word.length; i += width) {
        result.push(word.slice(i, i + width));
      }
      continue;
    }
    const candidate = current ? current + ' ' + word : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) result.push(current);
      current = word;
    }
  }
  if (current) result.push(current);
  return result;
}

function printThinkingBox(content: string): void {
  const c = termCols();
  // Layout: "  │  " (5) + content + "  │" (3) = 8 overhead
  const innerWidth = Math.max(1, c - 8);
  const lines = content.split('\n').map((l) => l.trimEnd()).filter(Boolean);

  const labelPart = '─ thinking ';
  // Top:    "  ╭" (3) + label (11) + fill + "╮" (1) = c
  const topFill = Math.max(0, c - 4 - labelPart.length);
  process.stdout.write('\n' + chalk.dim(`  ╭${labelPart}${'─'.repeat(topFill)}╮`) + '\n');
  for (const line of lines) {
    for (const chunk of wrapText(line, innerWidth)) {
      process.stdout.write(chalk.dim(`  │  ${chunk.padEnd(innerWidth)}  │`) + '\n');
    }
  }
  // Bottom: "  ╰" (3) + fill + "╯" (1) = c
  process.stdout.write(chalk.dim(`  ╰${'─'.repeat(c - 4)}╯`) + '\n');
}

function printTurnSummary(opts: { inTokens: number; outTokens: number; ms: number }): void {
  const { inTokens, outTokens, ms } = opts;
  const elapsed = (ms / 1000).toFixed(2) + 's';
  const parts: string[] = [];
  if (inTokens + outTokens > 0) parts.push(`↑ ${fmtTokens(inTokens)} ↓ ${fmtTokens(outTokens)}`);
  parts.push(elapsed);
  process.stdout.write('\n' + chalk.dim('  ' + parts.join('  ·  ')) + '\n');
}

function printUserPrompt(text: string): void {
  const c = termCols();
  process.stdout.write('\n' + chalk.bold.cyan('  you  ') + chalk.white(text) + '\n');
  process.stdout.write(chalk.dim('  ' + '─'.repeat(c - 2)) + '\n');
}

function printStepHeader(step: number): void {
  if (step === 1) return; // Skip header for first iteration (no noise)
  process.stdout.write(chalk.dim(`\n  ── step ${step} ──\n`));
}

// ── REPL ──────────────────────────────────────────────────────────────────────

// ── Vision helpers ────────────────────────────────────────────────────────────

function extractImages(text: string): { cleanedText: string; images: ImageContent[] } {
  const images: ImageContent[] = [];
  const cleaned = text.replace(/@([^\s]+\.(png|jpg|jpeg|gif|webp|bmp))/gi, (match, filePath: string) => {
    try {
      const resolved = resolve(process.cwd(), filePath);
      if (existsSync(resolved)) {
        const data = readFileSync(resolved);
        const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png';
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
        };
        images.push({ type: 'image', data: data.toString('base64'), mimeType: mimeMap[ext] ?? 'image/png' });
        return `[image: ${filePath}]`;
      }
    } catch { /* ignore unreadable files */ }
    return match;
  });
  return { cleanedText: cleaned, images };
}

export class REPL {
  private history = new ConversationHistory();
  private provider: Provider | undefined;
  private model = '';
  private rl: readline.Interface | null = null;
  private isProcessing = false;
  private stopThinkingFn: (() => void) | null = null;
  private abortController: AbortController | null = null;

  // Multi-line paste coalescing
  private lineBuffer: string[] = [];
  private coalesceTimer: ReturnType<typeof setTimeout> | null = null;

  // Multi-line composition (Shift+Enter / Alt+Enter)
  private multilineBuffer: string[] = [];

  // @ file mention autocomplete
  private mentionMode = false;
  private mentionQuery = '';
  private mentionFiles: Array<{ name: string; path: string }> = [];
  private mentionIndex = 0;
  private mentionScrollOffset = 0;
  private readonly MENTION_VISIBLE = 15;

  // / slash command autocomplete
  private slashMode = false;
  private slashQuery = '';
  private slashIndex = 0;
  private slashScrollOffset = 0;

  // / slash arg sub-dropdown (second level)
  private slashArgMode = false;
  private slashArgCmd = '';
  private slashArgOptions: Array<{ value: string; description?: string }> = [];
  private slashArgQuery = '';
  private slashArgIndex = 0;
  private slashArgScrollOffset = 0;

  // Think / format modes
  private thinkMode: boolean | 'low' | 'medium' | 'high' | undefined = undefined;
  private formatMode: 'json' | Record<string, unknown> | undefined = undefined;

  // Token accounting
  private sessionIn = 0;
  private sessionOut = 0;
  private contextWindow: number | undefined;
  private sessionStart = Date.now();

  async init(opts?: { provider?: string; model?: string }): Promise<void> {
    const config = getConfig();
    loadProviders(config.providers);

    const activeProvider = opts?.provider
      ? (getProvider(opts.provider) ?? getDefaultProvider(config.providers))
      : config.activeProvider
        ? getProvider(config.activeProvider)
        : getDefaultProvider(config.providers);

    this.provider = activeProvider;

    if (opts?.model) {
      this.model = opts.model;
    } else if (config.activeModel) {
      this.model = config.activeModel;
    } else if (activeProvider) {
      try {
        this.model = (await activeProvider.listModels())[0]?.id ?? '';
      } catch {
        this.model = '';
      }
    }

    if (this.provider && this.model) {
      try {
        const models = await this.provider.listModels();
        this.contextWindow = models.find((m) => m.id === this.model)?.contextWindow;
      } catch { /* ignore */ }
    }
  }

  private buildContext(): CommandContext {
    const self = this;
    return {
      history: this.history,
      provider: this.provider,
      get model() { return self.model; },
      set model(v: string) { self.model = v; },
      get contextWindow() { return self.contextWindow; },
    };
  }

  private getSystemPrompt(): string {
    const config = getConfig();
    const base = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const memory = formatMemoryForContext();
    const cwd = `Current working directory: ${process.cwd()}`;
    const platform = platformSystemPrompt();

    const { content: manthraMdContent } = loadManthraMd();
    const projectInstructions = manthraMdContent
      ? `# Project instructions (MANTHRA.md)\n\nThe following instructions come from the project's MANTHRA.md file. They are authoritative and override any conflicting defaults below. You MUST follow them exactly.\n\n${manthraMdContent}`
      : null;

    return [projectInstructions, base, cwd, platform, memory].filter(Boolean).join('\n\n');
  }

  // ── Terminal layout (scrolling region + fixed chrome) ────────────────────

  private rows = process.stdout.rows ?? 24;
  private readonly CHROME = 4;

  private get scrollEnd(): number { return Math.max(this.rows - this.CHROME, 5); }
  private get previewRow(): number { return this.rows - 3; }
  private get statusRow(): number { return this.rows - 2; }
  private get inputRow(): number { return this.rows - 1; }
  private get bottomRow(): number { return this.rows; }

  private formatElapsed(): string {
    const s = Math.floor((Date.now() - this.sessionStart) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  }

  private initLayout(): void {
    if (!process.stdout.isTTY) return;
    this.rows = process.stdout.rows ?? 24;
    process.stdout.write('\x1B[2J\x1B[H');
    process.stdout.write(`\x1B[1;${this.scrollEnd}r`);
    this.redrawChrome();
    process.stdout.write('\x1B[1;1H');
  }

  private redrawChrome(): void {
    if (!process.stdout.isTTY) return;
    const { statusRow: s, inputRow: inp, bottomRow: b } = this;
    const pName = this.provider?.name ?? '';
    const mRaw = this.model ?? '';
    const mShort = mRaw.length > 32 ? '…' + mRaw.slice(-31) : mRaw;
    const hasT = this.sessionIn + this.sessionOut > 0;
    const elapsed = hasT ? this.formatElapsed() : '';

    const statusLine =
      '  ' + chalk.hex('#3b82f6')('■') + '  ' +
      chalk.bold.white('Chat') + chalk.dim('  ·  ') +
      (pName ? chalk.dim(pName) + chalk.dim('  ·  ') : '') +
      chalk.dim(mShort) +
      (elapsed ? chalk.dim('  ·  ' + elapsed) : '');

    const tokInfo = hasT
      ? chalk.dim(`  ↑${fmtTokens(this.sessionIn)} ↓${fmtTokens(this.sessionOut)}`)
      : '';
    const ctxPct = (this.contextWindow && hasT)
      ? chalk.dim(`  ${((this.sessionIn + this.sessionOut) / this.contextWindow * 100).toFixed(0)}%`)
      : '';
    const bottomBar =
      chalk.dim('  ' + (pName ? pName + '  ·  ' : '') + mShort) +
      tokInfo + ctxPct + chalk.dim('   Ctrl+E: editor  ·  Manthra');

    process.stdout.write('\x1B7');
    process.stdout.write(`\x1B[${this.previewRow};1H\x1B[2K`);
    process.stdout.write(`\x1B[${s};1H\x1B[2K${statusLine}`);
    process.stdout.write(`\x1B[${inp};1H\x1B[2K`);
    process.stdout.write(`\x1B[${b};1H\x1B[2K${bottomBar}`);
    process.stdout.write('\x1B8');
  }

  private openBox(): void {
    if (!this.rl) return;
    if (!process.stdout.isTTY) { process.stdout.write('\n> '); return; }
    this.redrawChrome();
    process.stdout.write(`\x1B[${this.inputRow};1H\x1B[2K`);
    this.rl.setPrompt('  ');
    this.rl.prompt(true);
  }

  private closeBox(): void {
    if (!process.stdout.isTTY) return;
    process.stdout.write('\x1B7');
    process.stdout.write(`\x1B[${this.inputRow};1H\x1B[2K`);
    process.stdout.write('\x1B8');
    process.stdout.write(`\x1B[${this.scrollEnd};1H`);
  }

  // Listen for a lone ESC keypress and abort the current generation.
  // Returns a cleanup function to call when processing finishes.
  private listenForEsc(): () => void {
    if (!process.stdin.isTTY) return () => {};

    // Resume stdin so data events fire while readline is paused.
    process.stdin.resume();

    const onData = (data: Buffer) => {
      // A lone ESC is exactly one byte: 0x1B.
      // Escape sequences (arrow keys etc.) send 0x1B followed by more bytes
      // in the same chunk, so checking length === 1 filters those out.
      if (data.length === 1 && data[0] === 0x1b) {
        this.abortController?.abort();
      }
    };

    process.stdin.on('data', onData);

    return () => {
      process.stdin.off('data', onData);
    };
  }

  // ── Slash commands ────────────────────────────────────────────────────────

  private async handleSlashCommand(input: string): Promise<void> {
    const match = input.match(/^\/(\S*)(?:\s+(.*))?$/);
    if (!match) return;
    const [, name, args = ''] = match;
    if (!name) return;

    // Built-in REPL-level commands
    if (name === 'think') {
      const val = args.trim().toLowerCase();
      if (val === 'off' || val === 'false' || val === '0') {
        this.thinkMode = undefined;
        console.log(chalk.dim('\n  Think mode: off\n'));
      } else if (val === 'low' || val === 'medium' || val === 'high') {
        this.thinkMode = val as 'low' | 'medium' | 'high';
        console.log(chalk.dim(`\n  Think mode: ${val}\n`));
      } else {
        this.thinkMode = true;
        console.log(chalk.dim('\n  Think mode: on\n'));
      }
      return;
    }

    if (name === 'format') {
      const val = args.trim().toLowerCase();
      if (val === 'off' || val === 'false' || val === '0' || val === '') {
        this.formatMode = undefined;
        console.log(chalk.dim('\n  Format mode: off\n'));
      } else {
        this.formatMode = 'json';
        console.log(chalk.dim('\n  Format mode: json\n'));
      }
      return;
    }

    const command = getCommand(name);
    if (!command) {
      console.log(chalk.yellow(`\n  Unknown command: /${name}`));
      console.log(chalk.dim('  Type /help to see available commands.\n'));
      return;
    }
    await command.handler(args, this.buildContext());
  }

  // ── AI streaming ─────────────────────────────────────────────────────────

  private async processStream(
    stream: AsyncIterable<StreamEvent>,
    stopThinking: () => void,
  ): Promise<{
    text: string;
    toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
    usage?: { input_tokens: number; output_tokens: number };
  }> {
    let text = '';
    let usage: { input_tokens: number; output_tokens: number } | undefined;
    let thinkingBuf = '';
    let stoppedThinking = false;
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for await (const event of stream) {
      if (!stoppedThinking) {
        stopThinking();
        stoppedThinking = true;
      }
      switch (event.type) {
        case 'thinking_delta':
          if (event.delta) thinkingBuf += event.delta;
          break;
        case 'text_delta':
          if (event.delta) text += event.delta;
          break;
        case 'tool_call_done':
          if (event.tool_call) {
            toolCalls.push({
              id: event.tool_call.id,
              name: event.tool_call.name,
              input: event.tool_call.input ?? {},
            });
          }
          break;
        case 'message_done':
          if (event.usage) usage = event.usage;
          break;
        case 'error':
          console.error(chalk.red(`\n  Stream error: ${event.error}`));
          break;
      }
    }

    stopThinking();

    if (thinkingBuf.trim()) {
      printThinkingBox(thinkingBuf);
    }

    if (text.trim()) {
      process.stdout.write('\n' + formatMarkdown(text) + '\n');
    }

    return { text, toolCalls, usage };
  }

  private async runTurn(userMessage: string): Promise<{ turnIn: number; turnOut: number }> {
    if (!this.provider) {
      console.log(chalk.yellow('\n  No provider configured. Run `manthra web` to add one.\n'));
      return { turnIn: 0, turnOut: 0 };
    }

    // Extract @image.png references from user message
    const { cleanedText, images } = extractImages(userMessage);
    const effectiveMessage = cleanedText;

    if (images.length > 0) {
      // Add user message with image content blocks
      const contentBlocks: ContentBlock[] = [{ type: 'text', text: effectiveMessage }, ...images];
      this.history.add({ role: 'user', content: contentBlocks });
    } else {
      this.history.addUser(effectiveMessage);
    }

    const tools = getToolDefinitions();
    const MAX_ITER = 15;
    let iterCount = 0;
    let totalIn = 0;
    let totalOut = 0;
    const turnStart = Date.now();

    while (iterCount < MAX_ITER) {
      iterCount++;
      printStepHeader(iterCount);

      const systemPrompt = this.getSystemPrompt();
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        ...this.history.get(),
      ];

      let stream: AsyncIterable<StreamEvent>;
      try {
        stream = this.provider.chat(messages, {
          model: this.model,
          maxTokens: getConfig().maxTokens,
          temperature: getConfig().temperature,
          tools,
          think: this.thinkMode,
          format: this.formatMode,
          signal: this.abortController?.signal,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`\n  Provider error: ${msg}`));
        return { turnIn: totalIn, turnOut: totalOut };
      }

      this.stopThinkingFn = startThinking();
      let text: string;
      let toolCallsList: Array<{ id: string; name: string; input: Record<string, unknown> }>;
      let usage: { input_tokens: number; output_tokens: number } | undefined;

      try {
        ({ text, toolCalls: toolCallsList, usage } = await this.processStream(stream, this.stopThinkingFn));
        if (this.abortController?.signal.aborted) {
          process.stdout.write(chalk.dim('\n  ⎋  interrupted\n'));
          break;
        }
      } catch (err: unknown) {
        if (this.stopThinkingFn) { this.stopThinkingFn(); this.stopThinkingFn = null; }
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`\n  ${msg}`));
        return { turnIn: totalIn, turnOut: totalOut };
      }
      this.stopThinkingFn = null;

      totalIn += usage?.input_tokens ?? 0;
      totalOut += usage?.output_tokens ?? 0;

      // Build assistant content blocks
      const assistantContent: ContentBlock[] = [];
      if (text) {
        assistantContent.push({ type: 'text', text });
      }
      for (const tc of toolCallsList) {
        assistantContent.push({ type: 'tool_call', id: tc.id, name: tc.name, input: tc.input });
      }
      if (assistantContent.length > 0) {
        this.history.addAssistant(assistantContent);
      }

      // No tool calls → final answer, exit loop
      if (toolCallsList.length === 0) {
        break;
      }

      // Execute each tool and add results to history
      const toolResultBlocks: ContentBlock[] = [];
      for (const tc of toolCallsList) {
        const result = await executeTool(tc.name, tc.input);
        const resultContent = result.success
          ? result.output
          : `[ERROR] ${result.error ?? 'tool failed'}${result.output ? '\n' + result.output : ''}`;

        toolResultBlocks.push({
          type: 'tool_result',
          tool_call_id: tc.id,
          content: resultContent,
          is_error: !result.success,
        });
      }

      // Add tool results as a user message (per Ollama/OpenAI convention)
      if (toolResultBlocks.length > 0) {
        this.history.add({ role: 'user', content: toolResultBlocks });
      }
    }

    if (iterCount >= MAX_ITER) {
      process.stdout.write(chalk.yellow('\n  (reached max tool iterations)\n'));
    }

    printTurnSummary({ inTokens: totalIn, outTokens: totalOut, ms: Date.now() - turnStart });

    return { turnIn: totalIn, turnOut: totalOut };
  }

  // ── Input helpers ─────────────────────────────────────────────────────────

  private async openEditor(): Promise<void> {
    if (!this.rl || this.isProcessing) return;

    const tmpFile = `/tmp/manthra-${Date.now()}.txt`;
    writeFileSync(tmpFile, '');
    const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'nano';

    // Restore terminal to normal state before handing off to editor
    process.stdin.setRawMode(false);
    process.stdout.write('\x1B[?2004l');
    process.stdout.write('\x1B[>4;0m');
    process.stdout.write('\x1B[r');
    process.stdout.write('\x1B[2J\x1B[H');

    spawnSync(editor, [tmpFile], { stdio: 'inherit' });

    // Restore our layout
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write('\x1B[?2004h');
    process.stdout.write('\x1B[>4;2m');
    this.initLayout();

    const content = readFileSync(tmpFile, 'utf8').trim();
    try { unlinkSync(tmpFile); } catch { /* ignore */ }

    if (content) {
      void this.processLineInput(content);
    } else {
      this.openBox();
    }
  }

  private showMultilinePreview(): void {
    if (!process.stdout.isTTY) return;
    process.stdout.write('\x1B7');
    if (this.multilineBuffer.length > 0) {
      const preview = this.multilineBuffer.join(chalk.dim(' ↵ '));
      const maxLen = termCols() - 6;
      const plain = this.multilineBuffer.join(' ↵ ');
      const truncated = plain.length > maxLen
        ? chalk.dim('…') + preview.slice(-(maxLen - 1))
        : preview;
      process.stdout.write(
        `\x1B[${this.previewRow};1H\x1B[2K` +
        chalk.dim('  ┊ ') + chalk.white(truncated),
      );
      this.rl!.setPrompt(chalk.dim('  ┊  '));
    } else {
      process.stdout.write(`\x1B[${this.previewRow};1H\x1B[2K`);
      this.rl!.setPrompt('  ');
    }
    process.stdout.write('\x1B8');
    this.rl!.prompt(true);
  }

  private pasteFromClipboard(): void {
    if (!this.rl || this.isProcessing) return;
    try {
      let text: string;
      if (process.platform === 'darwin') {
        text = execSync('pbpaste').toString();
      } else if (process.platform === 'linux') {
        try {
          text = execSync('xclip -selection clipboard -o').toString();
        } catch {
          text = execSync('xsel --clipboard --output').toString();
        }
      } else {
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!trimmed.includes('\n')) {
        this.rl.write(trimmed);
      } else {
        const lineCount = trimmed.split('\n').length;
        process.stdout.write(chalk.dim(`\n  ✦ Pasting ${lineCount} lines…\n`));
        void this.processLineInput(trimmed);
      }
    } catch { /* clipboard not available */ }
  }

  // ── @ mention file picker ─────────────────────────────────────────────────

  private walkFiles(dir: string, prefix: string): string[] {
    const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
      'vendor', 'coverage', 'out', '.cache', 'target', '.turbo', '.vercel']);
    let results: string[] = [];
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isFile()) {
          results.push(rel);
          if (results.length >= 5000) return results;
        } else if (e.isDirectory()) {
          results = results.concat(this.walkFiles(join(dir, e.name), rel));
          if (results.length >= 5000) return results;
        }
      }
    } catch { /* skip unreadable dirs */ }
    return results;
  }

  private loadMentionFiles(): void {
    this.mentionFiles = this.walkFiles(process.cwd(), '').map(p => ({
      name: p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p,
      path: p,
    }));
  }

  private getVisibleMentionFiles(): Array<{ name: string; path: string }> {
    if (!this.mentionQuery) return this.mentionFiles;
    const q = this.mentionQuery.toLowerCase();
    return this.mentionFiles.filter(f =>
      q.includes('/') ? f.path.toLowerCase().includes(q) : f.name.toLowerCase().includes(q),
    );
  }

  private renderMentionDropdown(): void {
    if (!process.stdout.isTTY) return;
    const visible = this.getVisibleMentionFiles();
    const total = visible.length;
    const maxItems = Math.min(this.MENTION_VISIBLE, Math.max(1, this.scrollEnd - 6));

    // Clamp cursor to valid range
    this.mentionIndex = Math.max(0, Math.min(this.mentionIndex, total - 1));
    // Scroll window to keep cursor visible
    if (this.mentionIndex < this.mentionScrollOffset) {
      this.mentionScrollOffset = this.mentionIndex;
    } else if (this.mentionIndex >= this.mentionScrollOffset + maxItems) {
      this.mentionScrollOffset = this.mentionIndex - maxItems + 1;
    }

    const window = visible.slice(this.mentionScrollOffset, this.mentionScrollOffset + maxItems);
    const dropRows = Math.max(window.length, 1) + 1; // header + items
    const headerRow = this.scrollEnd - dropRows + 1;

    process.stdout.write('\x1B7');
    for (let i = 0; i < dropRows; i++) {
      process.stdout.write(`\x1B[${Math.max(1, headerRow + i)};1H\x1B[2K`);
    }

    const qDisplay = this.mentionQuery ? chalk.white(`@${this.mentionQuery}`) : chalk.dim('@');
    const posInfo = total > maxItems
      ? chalk.dim(`  ${this.mentionIndex + 1}/${total}`)
      : chalk.dim(`  ${total} file${total !== 1 ? 's' : ''}`);
    process.stdout.write(
      `\x1B[${headerRow};1H` +
      chalk.dim('  ') + qDisplay + posInfo +
      chalk.dim('  ↑↓ navigate  Tab/Enter select  Esc cancel'),
    );

    if (window.length === 0) {
      process.stdout.write(`\x1B[${headerRow + 1};1H${chalk.dim('  no matches')}`);
    } else {
      for (let i = 0; i < window.length; i++) {
        const row = headerRow + 1 + i;
        const item = window[i];
        const dir = item.path.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : '';
        const isSelected = this.mentionScrollOffset + i === this.mentionIndex;
        process.stdout.write(
          `\x1B[${row};1H` +
          (isSelected
            ? chalk.white('  ▶ ') + chalk.bold.white(item.name) + (dir ? chalk.dim('  ' + dir) : '')
            : chalk.dim('    ' + item.name) + (dir ? chalk.dim('  ' + dir) : '')),
        );
      }
    }

    process.stdout.write('\x1B8');
    this.rl?.prompt(true);
  }

  private clearMentionDropdown(): void {
    if (!process.stdout.isTTY) return;
    const clearRows = this.MENTION_VISIBLE + 3;
    const startRow = this.scrollEnd - clearRows + 1;
    process.stdout.write('\x1B7');
    for (let i = 0; i < clearRows; i++) {
      process.stdout.write(`\x1B[${Math.max(1, startRow + i)};1H\x1B[2K`);
    }
    process.stdout.write('\x1B8');
  }

  private exitMentionMode(selectFile?: string): void {
    this.clearMentionDropdown();
    this.mentionMode = false;
    this.mentionQuery = '';
    this.mentionIndex = 0;
    this.mentionScrollOffset = 0;
    this.mentionFiles = [];

    if (selectFile && this.rl) {
      const line = (this.rl as unknown as { line: string }).line ?? '';
      const atIdx = line.lastIndexOf('@');
      if (atIdx !== -1) {
        const prefix = line.slice(0, atIdx);
        this.rl.write('', { ctrl: true, name: 'u' });
        this.rl.write(prefix + '@' + selectFile);
      }
    } else {
      this.rl?.prompt(true);
    }
  }

  // ── / slash command picker ────────────────────────────────────────────────

  private getSlashCommandList(): Array<{ name: string; description: string; usage?: string }> {
    const repl = [
      { name: 'think', description: 'Toggle extended thinking mode', usage: '[off|low|medium|high]' },
      { name: 'format', description: 'Force output format', usage: '[off|json]' },
    ];
    return [
      ...getAllCommands().map(c => ({ name: c.name, description: c.description, usage: c.usage })),
      ...repl,
    ].sort((a, b) => a.name.localeCompare(b.name));
  }

  private getVisibleSlashCommands(): Array<{ name: string; description: string; usage?: string }> {
    const all = this.getSlashCommandList();
    if (!this.slashQuery) return all;
    const q = this.slashQuery.toLowerCase();
    return all.filter(c => c.name.toLowerCase().startsWith(q));
  }

  private renderSlashDropdown(): void {
    if (!process.stdout.isTTY) return;
    const visible = this.getVisibleSlashCommands();
    const total = visible.length;
    const maxItems = Math.min(this.MENTION_VISIBLE, Math.max(1, this.scrollEnd - 6));

    this.slashIndex = Math.max(0, Math.min(this.slashIndex, total - 1));
    if (this.slashIndex < this.slashScrollOffset) {
      this.slashScrollOffset = this.slashIndex;
    } else if (this.slashIndex >= this.slashScrollOffset + maxItems) {
      this.slashScrollOffset = this.slashIndex - maxItems + 1;
    }

    const win = visible.slice(this.slashScrollOffset, this.slashScrollOffset + maxItems);
    const dropRows = Math.max(win.length, 1) + 1;
    const headerRow = this.scrollEnd - dropRows + 1;

    process.stdout.write('\x1B7');
    for (let i = 0; i < dropRows; i++) {
      process.stdout.write(`\x1B[${Math.max(1, headerRow + i)};1H\x1B[2K`);
    }

    const qDisplay = this.slashQuery ? chalk.white(`/${this.slashQuery}`) : chalk.dim('/');
    const posInfo = total > maxItems
      ? chalk.dim(`  ${this.slashIndex + 1}/${total}`)
      : chalk.dim(`  ${total} command${total !== 1 ? 's' : ''}`);
    process.stdout.write(
      `\x1B[${headerRow};1H` +
      chalk.dim('  ') + qDisplay + posInfo +
      chalk.dim('  ↑↓ navigate  Tab insert  Enter run  Esc cancel'),
    );

    if (win.length === 0) {
      process.stdout.write(`\x1B[${headerRow + 1};1H${chalk.dim('  no matches')}`);
    } else {
      for (let i = 0; i < win.length; i++) {
        const row = headerRow + 1 + i;
        const cmd = win[i];
        const isSelected = this.slashScrollOffset + i === this.slashIndex;
        const sig = '/' + cmd.name + (cmd.usage ? ' ' + cmd.usage : '');
        process.stdout.write(
          `\x1B[${row};1H` +
          (isSelected
            ? chalk.white('  ▶ ') + chalk.bold.white(sig) + chalk.dim('  ' + cmd.description)
            : chalk.dim('    ' + sig + '  ' + cmd.description)),
        );
      }
    }

    process.stdout.write('\x1B8');
    this.rl?.prompt(true);
  }

  private clearSlashDropdown(): void {
    if (!process.stdout.isTTY) return;
    const clearRows = this.MENTION_VISIBLE + 3;
    const startRow = this.scrollEnd - clearRows + 1;
    process.stdout.write('\x1B7');
    for (let i = 0; i < clearRows; i++) {
      process.stdout.write(`\x1B[${Math.max(1, startRow + i)};1H\x1B[2K`);
    }
    process.stdout.write('\x1B8');
  }

  private exitSlashMode(selectCmd?: string, execute = false): void {
    this.clearSlashDropdown();
    this.slashMode = false;
    this.slashQuery = '';
    this.slashIndex = 0;
    this.slashScrollOffset = 0;

    if (selectCmd !== undefined && this.rl) {
      if (execute) {
        // For commands with no known args, run immediately
        const opts = this.getCommandOptions(selectCmd);
        if (opts && opts.length > 0) {
          // Enter on a command with options → open arg picker instead
          void this.enterSlashArgMode(selectCmd);
        } else {
          void this.processLineInput('/' + selectCmd);
        }
      } else {
        // Tab: open arg picker if command has options, else insert text
        const opts = this.getCommandOptions(selectCmd);
        if (opts && opts.length > 0) {
          void this.enterSlashArgMode(selectCmd);
        } else {
          const cmdInfo = this.getSlashCommandList().find(c => c.name === selectCmd);
          this.rl.write('', { ctrl: true, name: 'u' });
          this.rl.write('/' + selectCmd + (cmdInfo?.usage ? ' ' : ''));
        }
      }
    } else {
      this.rl?.prompt(true);
    }
  }

  private getCommandOptions(cmdName: string): Array<{ value: string; description?: string }> | null {
    switch (cmdName) {
      case 'think':
        return [
          { value: 'off', description: 'Disable extended thinking' },
          { value: 'low', description: 'Low thinking budget' },
          { value: 'medium', description: 'Medium thinking budget' },
          { value: 'high', description: 'High thinking budget' },
        ];
      case 'format':
        return [
          { value: 'off', description: 'Default markdown output' },
          { value: 'json', description: 'Force JSON output format' },
        ];
      default:
        return null;
    }
  }

  private async enterSlashArgMode(cmdName: string): Promise<void> {
    let opts = this.getCommandOptions(cmdName);

    // Dynamic: fetch models for /model command
    if (cmdName === 'model' && this.provider) {
      try {
        const models = await this.provider.listModels();
        opts = models.map(m => ({ value: m.id, description: m.name !== m.id ? m.name : undefined }));
      } catch {
        opts = null;
      }
    }

    if (!opts || opts.length === 0) {
      // No options — just insert the command name with a space
      this.rl?.write('', { ctrl: true, name: 'u' });
      this.rl?.write('/' + cmdName + ' ');
      return;
    }

    this.slashArgMode = true;
    this.slashArgCmd = cmdName;
    this.slashArgOptions = opts;
    this.slashArgQuery = '';
    this.slashArgIndex = 0;
    this.slashArgScrollOffset = 0;

    // Write command name into readline so user sees it
    this.rl?.write('', { ctrl: true, name: 'u' });
    this.rl?.write('/' + cmdName + ' ');

    this.renderSlashArgDropdown();
  }

  private getVisibleSlashArgOptions(): Array<{ value: string; description?: string }> {
    if (!this.slashArgQuery) return this.slashArgOptions;
    const q = this.slashArgQuery.toLowerCase();
    return this.slashArgOptions.filter(o => o.value.toLowerCase().startsWith(q));
  }

  private renderSlashArgDropdown(): void {
    if (!process.stdout.isTTY) return;
    const visible = this.getVisibleSlashArgOptions();
    const total = visible.length;
    const maxItems = Math.min(this.MENTION_VISIBLE, Math.max(1, this.scrollEnd - 6));

    this.slashArgIndex = Math.max(0, Math.min(this.slashArgIndex, total - 1));
    if (this.slashArgIndex < this.slashArgScrollOffset) {
      this.slashArgScrollOffset = this.slashArgIndex;
    } else if (this.slashArgIndex >= this.slashArgScrollOffset + maxItems) {
      this.slashArgScrollOffset = this.slashArgIndex - maxItems + 1;
    }

    const win = visible.slice(this.slashArgScrollOffset, this.slashArgScrollOffset + maxItems);
    const dropRows = Math.max(win.length, 1) + 1;
    const headerRow = this.scrollEnd - dropRows + 1;

    process.stdout.write('\x1B7');
    for (let i = 0; i < dropRows; i++) {
      process.stdout.write(`\x1B[${Math.max(1, headerRow + i)};1H\x1B[2K`);
    }

    const qDisplay = chalk.white(`/${this.slashArgCmd}`) + chalk.dim(' ') +
      (this.slashArgQuery ? chalk.white(this.slashArgQuery) : chalk.dim('<option>'));
    const posInfo = total > maxItems
      ? chalk.dim(`  ${this.slashArgIndex + 1}/${total}`)
      : chalk.dim(`  ${total} option${total !== 1 ? 's' : ''}`);
    process.stdout.write(
      `\x1B[${headerRow};1H` +
      chalk.dim('  ') + qDisplay + posInfo +
      chalk.dim('  ↑↓ navigate  Tab/Enter select  Esc back'),
    );

    if (win.length === 0) {
      process.stdout.write(`\x1B[${headerRow + 1};1H${chalk.dim('  no matches')}`);
    } else {
      for (let i = 0; i < win.length; i++) {
        const row = headerRow + 1 + i;
        const opt = win[i];
        const isSelected = this.slashArgScrollOffset + i === this.slashArgIndex;
        process.stdout.write(
          `\x1B[${row};1H` +
          (isSelected
            ? chalk.white('  ▶ ') + chalk.bold.white(opt.value) + (opt.description ? chalk.dim('  ' + opt.description) : '')
            : chalk.dim('    ' + opt.value + (opt.description ? '  ' + opt.description : ''))),
        );
      }
    }

    process.stdout.write('\x1B8');
    this.rl?.prompt(true);
  }

  private clearSlashArgDropdown(): void {
    if (!process.stdout.isTTY) return;
    const clearRows = this.MENTION_VISIBLE + 3;
    const startRow = this.scrollEnd - clearRows + 1;
    process.stdout.write('\x1B7');
    for (let i = 0; i < clearRows; i++) {
      process.stdout.write(`\x1B[${Math.max(1, startRow + i)};1H\x1B[2K`);
    }
    process.stdout.write('\x1B8');
  }

  private exitSlashArgMode(selectValue?: string, execute = false): void {
    this.clearSlashArgDropdown();
    const cmd = this.slashArgCmd;
    this.slashArgMode = false;
    this.slashArgCmd = '';
    this.slashArgOptions = [];
    this.slashArgQuery = '';
    this.slashArgIndex = 0;
    this.slashArgScrollOffset = 0;

    if (selectValue !== undefined && this.rl) {
      this.rl.write('', { ctrl: true, name: 'u' });
      if (execute) {
        void this.processLineInput('/' + cmd + ' ' + selectValue);
      } else {
        this.rl.write('/' + cmd + ' ' + selectValue);
      }
    } else {
      this.rl?.prompt(true);
    }
  }

  // ── Input processing ─────────────────────────────────────────────────────

  private async processLineInput(input: string): Promise<void> {
    this.closeBox();

    if (!input) { this.openBox(); return; }

    if (input.startsWith('/')) {
      await this.handleSlashCommand(input);
      this.openBox();
      return;
    }

    printUserPrompt(input);
    this.isProcessing = true;
    this.rl!.pause();
    this.abortController = new AbortController();
    const cleanupEsc = this.listenForEsc();
    try {
      const { turnIn, turnOut } = await this.runTurn(input);
      this.sessionIn += turnIn;
      this.sessionOut += turnOut;
    } catch (err: unknown) {
      if (this.stopThinkingFn) { this.stopThinkingFn(); this.stopThinkingFn = null; }
      console.log(chalk.red(`\n  ${err instanceof Error ? err.message : err}`));
    } finally {
      cleanupEsc();
      this.abortController = null;
    }
    this.isProcessing = false;
    this.rl!.resume();
    this.openBox();
  }

  // ── Main loop ─────────────────────────────────────────────────────────────

  async run(): Promise<void> {
    // ── Bracketed paste setup ───────────────────────────────────────────────
    // Route stdin through a PassThrough proxy so we can intercept bracketed
    // paste sequences (\x1B[200~ … \x1B[201~) before readline sees them.
    // Paste content is captured as a whole and submitted as one message.
    // Normal keystrokes are forwarded to the proxy unchanged.
    let rlInput: NodeJS.ReadableStream = process.stdin;
    let disablePaste = () => {};

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdout.write('\x1B[?2004h'); // enable bracketed paste
      process.stdout.write('\x1B[>4;2m');  // modifyOtherKeys mode 2 (makes Shift+Enter distinct)

      const proxy = new PassThrough();
      rlInput = proxy;

      let pasting = false;
      let pasteBuf = '';

      const onData = (chunk: Buffer) => {
        const s = chunk.toString('utf8');

        // Ctrl+E (0x05): open external editor for multi-line composition
        if (chunk.length === 1 && chunk[0] === 0x05 && !this.isProcessing) {
          void this.openEditor();
          return;
        }

        // Ctrl+V (0x16): explicit clipboard paste for terminals without bracketed paste
        if (chunk.length === 1 && chunk[0] === 0x16 && !this.isProcessing) {
          this.pasteFromClipboard();
          return;
        }

        // Shift+Enter: add a new line to the multi-line buffer without submitting
        // \x1B[27;2;13~ = modifyOtherKeys mode 2 (xterm/iTerm2)
        // \x1B[13;2u   = CSI u / Kitty protocol
        // \x1B\r       = Alt+Enter / Option+Enter (reliable macOS fallback)
        const isNewlineKey =
          s === '\x1B[27;2;13~' ||
          s === '\x1B[13;2u' ||
          (chunk.length === 2 && chunk[0] === 0x1b && chunk[1] === 0x0d);
        if (isNewlineKey && !this.isProcessing) {
          const currentLine = (this.rl as unknown as { line: string }).line ?? '';
          this.multilineBuffer.push(currentLine);
          // Clear the current readline input
          this.rl!.write('', { ctrl: true, name: 'u' });
          this.showMultilinePreview();
          return;
        }

        if (pasting || s.includes('\x1B[200~')) {
          if (!pasting) {
            pasting = true;
            pasteBuf = s.slice(s.indexOf('\x1B[200~') + 6);
          } else {
            pasteBuf += s;
          }

          if (pasteBuf.includes('\x1B[201~')) {
            const content = pasteBuf.slice(0, pasteBuf.indexOf('\x1B[201~'));
            pasting = false;
            pasteBuf = '';
            if (this.rl && !this.isProcessing) {
              const trimmed = content.trim();
              if (!trimmed.includes('\n')) {
                // Single-line paste: insert into buffer so user can edit before submitting
                this.rl.write(trimmed);
              } else {
                // Multi-line paste: show line count and submit
                const lineCount = trimmed.split('\n').length;
                process.stdout.write(chalk.dim(`\n  ✦ Pasting ${lineCount} lines…\n`));
                void this.processLineInput(trimmed);
              }
            }
          }
          return; // don't forward paste bytes to readline
        }

        // ── / slash arg sub-dropdown ────────────────────────────────────────
        if (this.slashArgMode) {
          const visible = this.getVisibleSlashArgOptions();
          const selected = visible[this.slashArgIndex]?.value;

          if (s === '\x1B[A') {
            this.slashArgIndex = Math.max(0, this.slashArgIndex - 1);
            this.renderSlashArgDropdown();
            return;
          }
          if (s === '\x1B[B') {
            this.slashArgIndex = Math.min(Math.max(0, visible.length - 1), this.slashArgIndex + 1);
            this.renderSlashArgDropdown();
            return;
          }
          if (s === '\t') {
            this.exitSlashArgMode(selected, false);
            return;
          }
          if (s === '\r') {
            this.exitSlashArgMode(selected, true);
            return;
          }
          if (chunk.length === 1 && chunk[0] === 0x1b) {
            this.exitSlashArgMode();
            return;
          }
          if (chunk[0] === 0x7f || chunk[0] === 0x08) {
            if (this.slashArgQuery.length > 0) {
              this.slashArgQuery = this.slashArgQuery.slice(0, -1);
              this.slashArgIndex = 0;
              this.slashArgScrollOffset = 0;
              this.renderSlashArgDropdown();
            } else {
              this.exitSlashArgMode();
            }
            return;
          }
          if (s.length === 1 && s.charCodeAt(0) >= 32) {
            this.slashArgQuery += s;
            this.slashArgIndex = 0;
            this.slashArgScrollOffset = 0;
            this.renderSlashArgDropdown();
          }
          return;
        }

        // ── / slash command autocomplete ────────────────────────────────────
        const wasInSlashMode = this.slashMode;

        if (s === '/' && !wasInSlashMode && !this.mentionMode && !this.slashArgMode && !this.isProcessing) {
          const currentLine = (this.rl as unknown as { line: string }).line ?? '';
          if (currentLine === '') {
            this.slashMode = true;
            this.slashQuery = '';
            this.slashIndex = 0;
            this.slashScrollOffset = 0;
            this.renderSlashDropdown();
            // fall through: let readline echo '/'
          }
        }

        if (wasInSlashMode) {
          const visible = this.getVisibleSlashCommands();
          const selected = visible[this.slashIndex]?.name;

          if (s === '\x1B[A') {
            this.slashIndex = Math.max(0, this.slashIndex - 1);
            this.renderSlashDropdown();
            return;
          }
          if (s === '\x1B[B') {
            this.slashIndex = Math.min(Math.max(0, visible.length - 1), this.slashIndex + 1);
            this.renderSlashDropdown();
            return;
          }
          if (s === '\t') {
            this.exitSlashMode(selected, false);
            return;
          }
          if (s === '\r') {
            if (selected) {
              this.exitSlashMode(selected, true);
            } else {
              this.exitSlashMode();
            }
            return;
          }
          if (chunk.length === 1 && chunk[0] === 0x1b) {
            this.exitSlashMode();
            return;
          }
          if (chunk[0] === 0x7f || chunk[0] === 0x08) {
            if (this.slashQuery.length > 0) {
              this.slashQuery = this.slashQuery.slice(0, -1);
              this.slashIndex = 0;
              this.slashScrollOffset = 0;
              this.renderSlashDropdown();
            } else {
              this.slashMode = false;
              this.slashScrollOffset = 0;
              this.clearSlashDropdown();
            }
            // fall through: let readline handle visual deletion
          } else if (s.length === 1 && s.charCodeAt(0) >= 32) {
            this.slashQuery += s;
            this.slashIndex = 0;
            this.slashScrollOffset = 0;
            this.renderSlashDropdown();
            // fall through: let readline echo the char
          }
        }

        // ── @ file mention autocomplete ─────────────────────────────────────
        const wasInMentionMode = this.mentionMode;

        if (s === '@' && !wasInMentionMode && !this.isProcessing) {
          this.mentionMode = true;
          this.mentionQuery = '';
          this.mentionIndex = 0;
          this.loadMentionFiles();
          this.renderMentionDropdown();
          // fall through: let readline echo '@'
        }

        if (wasInMentionMode) {
          const visible = this.getVisibleMentionFiles();
          const selected = visible[this.mentionIndex]?.path;

          if (s === '\x1B[A') {
            this.mentionIndex = Math.max(0, this.mentionIndex - 1);
            this.renderMentionDropdown();
            return;
          }
          if (s === '\x1B[B') {
            this.mentionIndex = Math.min(Math.max(0, visible.length - 1), this.mentionIndex + 1);
            this.renderMentionDropdown();
            return;
          }
          if (s === '\t') {
            this.exitMentionMode(selected);
            return;
          }
          if (s === '\r') {
            this.exitMentionMode(selected);
            return;
          }
          if (chunk.length === 1 && chunk[0] === 0x1b) {
            this.exitMentionMode();
            return;
          }
          if (chunk[0] === 0x7f || chunk[0] === 0x08) {
            if (this.mentionQuery.length > 0) {
              this.mentionQuery = this.mentionQuery.slice(0, -1);
              this.mentionIndex = 0;
              this.mentionScrollOffset = 0;
              this.renderMentionDropdown();
            } else {
              this.mentionMode = false;
              this.mentionScrollOffset = 0;
              this.clearMentionDropdown();
            }
            // fall through: let readline handle visual deletion
          } else if (s.length === 1 && s.charCodeAt(0) >= 32) {
            this.mentionQuery += s;
            this.mentionIndex = 0;
            this.mentionScrollOffset = 0;
            this.renderMentionDropdown();
            // fall through: let readline echo the char
          }
        }

        proxy.write(chunk);
      };

      process.stdin.on('data', onData);
      process.stdin.once('end', () => proxy.end());
      process.stdin.once('close', () => proxy.destroy());

      disablePaste = () => {
        process.stdin.off('data', onData);
        process.stdout.write('\x1B[?2004l'); // disable bracketed paste
        process.stdout.write('\x1B[>4;0m');  // restore modifyOtherKeys default
      };
    }

    this.rl = readline.createInterface({
      input: rlInput,
      output: process.stdout,
      prompt: '',
      terminal: process.stdin.isTTY,
    });

    this.initLayout();

    const { sources: mdSources } = loadManthraMd();
    if (mdSources.length > 0) {
      const cwd = process.cwd();
      const labels = mdSources.map((s) => (s.startsWith(cwd) ? s.slice(cwd.length + 1) : s));
      process.stdout.write(chalk.dim(`  ✦  MANTHRA.md: ${labels.join('  ·  ')}\n`));
    }

    process.stdout.on('resize', () => {
      this.rows = process.stdout.rows ?? 24;
      process.stdout.write(`\x1B[1;${this.scrollEnd}r`);
      this.redrawChrome();
      process.stdout.write(`\x1B[${this.inputRow};1H\x1B[2K`);
      this.rl?.prompt(true);
    });

    this.openBox();

    this.rl.on('line', (raw) => {
      // If in multi-line mode, combine buffered lines with current line
      if (this.multilineBuffer.length > 0) {
        const combined = [...this.multilineBuffer, raw].join('\n');
        this.multilineBuffer = [];
        this.showMultilinePreview(); // clears the preview row and resets prompt
        void this.processLineInput(combined.trim());
        return;
      }

      if (this.coalesceTimer) clearTimeout(this.coalesceTimer);
      this.lineBuffer.push(raw);
      this.coalesceTimer = setTimeout(() => {
        const input = this.lineBuffer.join('\n').trim();
        this.lineBuffer = [];
        this.coalesceTimer = null;
        void this.processLineInput(input);
      }, 20);
    });

    this.rl.on('close', () => {
      disablePaste();
      if (process.stdout.isTTY) {
        process.stdout.write('\x1B[r');
        process.stdout.write(`\x1B[${this.rows};1H\n`);
      }
      if (this.history.length() > 0) this.history.save();
      console.log(chalk.gray('  Goodbye!\n'));
      process.exit(0);
    });

    process.on('SIGINT', () => {
      if (process.stdout.isTTY) process.stdout.write(`\x1B[${this.scrollEnd};1H`);
      if (this.isProcessing) {
        if (this.stopThinkingFn) { this.stopThinkingFn(); this.stopThinkingFn = null; }
        process.stdout.write(chalk.gray('\n  (interrupted)\n'));
        this.isProcessing = false;
        this.rl!.resume();
        this.openBox();
      } else {
        process.stdout.write(chalk.gray('\n  Ctrl+D to exit, or type /exit.\n'));
        this.openBox();
      }
    });
  }

  async runOnce(message: string): Promise<void> {
    await this.runTurn(message);
  }
}
