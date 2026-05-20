import * as readline from 'readline';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import type { Provider, Message, ContentBlock, StreamEvent, ImageContent } from '../providers/types.js';
import { ConversationHistory } from '../conversation/index.js';
import { getConfig } from '../config/loader.js';
import { loadProviders, getProvider, getDefaultProvider } from '../providers/registry.js';
import { DEFAULT_SYSTEM_PROMPT } from '../config/defaults.js';
import { formatMemoryForContext } from '../memory/store.js';
import { getCommand } from '../slash-commands/registry.js';
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

function printThinkingBox(content: string): void {
  const c = termCols();
  const innerWidth = c - 6;
  const lines = content.split('\n').map((l) => l.trimEnd()).filter(Boolean);

  const labelPart = '─ thinking ';
  const topFill = Math.max(0, c - 3 - labelPart.length);
  process.stdout.write('\n' + chalk.dim(`  ╭${labelPart}${'─'.repeat(topFill)}`) + '\n');
  for (const line of lines) {
    process.stdout.write(chalk.dim(`  │  ${line.slice(0, innerWidth)}\n`));
  }
  process.stdout.write(chalk.dim(`  ╰${'─'.repeat(c - 3)}`) + '\n');
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
  private readonly CHROME = 3;

  private get scrollEnd(): number { return Math.max(this.rows - this.CHROME, 5); }
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
      tokInfo + ctxPct + chalk.dim('   Manthra');

    process.stdout.write('\x1B7');
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

  // ── Main loop ─────────────────────────────────────────────────────────────

  async run(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
      terminal: true,
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

    this.rl.on('line', async (raw) => {
      const input = raw.trim();
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
    });

    this.rl.on('close', () => {
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
