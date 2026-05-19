import * as readline from 'readline';
import chalk from 'chalk';
import type { Provider, Message, ContentBlock, StreamEvent } from '../providers/types.js';
import { ConversationHistory } from '../conversation/index.js';
import { getToolDefinitions } from '../tools/registry.js';
import { executeTool } from '../tools/executor.js';
import { getConfig } from '../config/loader.js';
import { loadProviders, getProvider, getDefaultProvider } from '../providers/registry.js';
import { DEFAULT_SYSTEM_PROMPT } from '../config/defaults.js';
import { formatMemoryForContext } from '../memory/store.js';
import { getCommand } from '../slash-commands/registry.js';
import type { CommandContext } from '../slash-commands/types.js';
import { formatMarkdown } from '../ui/renderer.js';
import { loadManthraMd } from '../config/manthra-md.js';
import { platformSystemPrompt } from '../tools/platform.js';

// ── Thinking animation ────────────────────────────────────────────────────────

const THINKING = [
  'Thinking', 'Reasoning', 'Processing', 'Analyzing', 'Reflecting', 'Pondering', 'Contemplating', 'Deliberating', 'Evaluating', 'Interpreting', 'Understanding', 'Figuring it out', 'Working it out', 'Breaking it down', 'Connecting ideas', 'Synthesizing', 'Formulating', 'Organizing thoughts', 'Reviewing', 'Rechecking', 'Brainstorming', 'Tinkering', 'Exploring', 'Digging in', 'Untangling', 'Decoding', 'Mapping it out', 'Piecing it together', 'Cooking up an answer', 'Sharpening logic', 'Structuring output', 'Building context', 'Scanning possibilities', 'Weighing options', 'Filtering noise', 'Optimizing reasoning', 'Searching patterns', 'Testing ideas', 'Simulating outcomes', 'Let me think', 'Let’s see', 'Hmm', 'One moment', 'Almost there', 'Thinking through this', 'Working on it', 'Getting clarity', 'Putting it together', 'Double-checking', 'Stepping through it', 'Re-evaluating', 'Getting the details right', 'Holding that thought', 'Forming response', 'Constructing answer', 'Drafting logic', 'Aligning ideas', 'Sorting information', 'Processing inputs', 'Parsing meaning', 'Extracting insight', 'Reviewing data', 'Inspecting details', 'Examining closely', 'Looking deeper', 'Going deeper', 'Thinking deeper', 'Expanding thought', 'Narrowing focus', 'Clarifying intent', 'Inferring meaning', 'Drawing conclusions', 'Reassessing', 'Reconstructing logic', 'Rebuilding understanding', 'Checking assumptions', 'Validating idea', 'Confirming reasoning', 'Running analysis', 'Mental modeling', 'Cognitive processing', 'Pattern matching', 'Signal extraction', 'Noise reduction', 'Idea exploration', 'Thought formation', 'Logic building', 'Insight generation', 'Knowledge synthesis', 'Information structuring', 'Context building', 'Thought sequencing', 'Reasoning step-by-step', 'Breaking complexity', 'Simplifying structure', 'Organizing reasoning chain', 'Evaluating possibilities', 'Exploring angles', 'Considering options', 'Weighing evidence', 'Checking consistency', 'Testing logic', 'Verifying steps', 'Debugging thought process', 'Running mental simulation', 'Iterating reasoning', 'Refining answer', 'Improving clarity', 'Enhancing logic', 'Tightening explanation', 'Strengthening argument', 'Reworking idea', 'Adjusting reasoning', 'Fine-tuning output', 'Polishing thought', 'Finalizing reasoning', 'Almost ready', 'Nearly done', 'Getting there', 'Still thinking', 'Just a second', 'Give me a moment', 'Working through details', 'Sorting complexity', 'Handling nuance', 'Parsing context', 'Reading between lines', 'Understanding structure', 'Building response', 'Preparing answer', 'Assembling logic', 'Collecting thoughts', 'Gathering insight', 'Pulling information together', 'Organizing response', 'Structuring reply', 'Composing answer', 'Writing mentally', 'Forming explanation', 'Drafting response', 'Thinking aloud', 'Internal reasoning', 'Silent analysis', 'Deep processing', 'Fast reasoning', 'Slow careful thinking', 'Careful analysis', 'Quick evaluation', 'Rapid processing', 'Thorough examination', 'Light analysis', 'Heavy reasoning', 'Deep dive', 'Surface scan', 'Mental pass', 'Second pass analysis', 'Third pass review', 'Multi-step reasoning', 'Layered thinking', 'Hierarchical analysis', 'Sequential reasoning', 'Parallel thinking', 'Concept mapping', 'Idea linking', 'Knowledge traversal', 'Reasoning traversal', 'Cognitive scan', 'Analytical sweep', 'Insight sweep', 'Thought scan', 'Reasoning pass', 'Logic pass', 'Evaluation pass', 'Review pass', 'Check pass', 'Final pass', 'Initial thinking', 'First impression analysis', 'Early reasoning', 'Mid reasoning', 'Late stage thinking', 'Pre-finalizing', 'Post-processing', 'Pre-processing thought', 'Bootstrapping reasoning', 'Stabilizing answer', 'Converging on solution', 'Diverging ideas', 'Exploring branches', 'Pruning options', 'Selecting path', 'Decision forming', 'Judgment processing', 'Opinion forming', 'Insight crystallizing', 'Thought crystallization', 'Idea refinement', 'Signal interpretation', 'Context interpretation', 'Meaning extraction', 'Intent detection', 'Goal alignment', 'Response shaping', 'Output crafting', 'Answer shaping', 'Logic shaping', 'Reasoning shaping', 'Structuring insight', 'Organizing cognition', 'Mental structuring', 'Cognitive structuring', 'Thought architecture', 'Reasoning architecture', 'Building framework', 'Constructing framework', 'Framework analysis', 'System thinking', 'Holistic reasoning', 'Linear reasoning', 'Nonlinear reasoning', 'Abstract thinking', 'Concrete reasoning', 'Meta thinking', 'Self-checking logic', 'Recursive thinking', 'Iterative thinking', 'Continuous processing', 'Active reasoning', 'Passive analysis', 'Background thinking', 'Foreground reasoning', 'Focused thinking', 'Diffuse thinking', 'Expanding analysis', 'Compressing thought', 'Condensing reasoning', 'Elaborating idea', 'Summarizing mentally', 'Extracting core idea', 'Identifying key points', 'Highlighting relevance', 'Filtering importance', 'Ranking ideas', 'Prioritizing logic', 'Ordering thoughts', 'Sequencing ideas', 'Aligning reasoning', 'Harmonizing output', 'Stabilizing logic', 'Balancing arguments', 'Cross-checking', 'Multi-angle analysis', 'Perspective shifting', 'Context switching', 'Mental adjustment', 'Adaptive reasoning', 'Dynamic thinking', 'Fluid analysis', 'Structured reasoning', 'Unstructured exploration', 'Open-ended thinking', 'Goal-oriented reasoning', 'Task-focused thinking', 'Solution search', 'Answer search', 'Insight search', 'Meaning search', 'Logic search', 'Pattern search', 'Connection search', 'Deep inspection', 'Broad scan', 'Narrow focus', 'Zooming in', 'Zooming out', 'Perspective zoom', 'Detail checking', 'Macro analysis', 'Micro analysis', 'System scan', 'Cognitive load processing', 'Thought compression', 'Idea expansion', 'Reasoning expansion', 'Clarification pass', 'Final review', 'Pre-output check', 'Output validation', 'Response preparation', 'Answer finalization', 'Done thinking',
];
const SPIN = ['⠋', '⠙', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[mGKHFA-Z]/g, '');
}

function fmtTokens(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
}

// ── REPL ──────────────────────────────────────────────────────────────────────

export class REPL {
  private history = new ConversationHistory();
  private provider: Provider | undefined;
  private model = '';
  private rl: readline.Interface | null = null;
  private isProcessing = false;
  private stopThinkingFn: (() => void) | null = null;

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
    this.model = opts?.model
      || config.activeModel
      || (activeProvider ? (await activeProvider.listModels())[0]?.id ?? '' : '');

    // Resolve context window for the active model (best-effort)
    if (this.provider) {
      try {
        const models = await this.provider.listModels();
        this.contextWindow = models.find(m => m.id === this.model)?.contextWindow;
      } catch { /* ignore */ }
    }
  }

  private buildContext(): CommandContext {
    return {
      history: this.history,
      provider: this.provider,
      model: this.model,
    };
  }

  private getSystemPrompt(): string {
    const config = getConfig();
    const base = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const memory = formatMemoryForContext();
    const cwd = `Current working directory: ${process.cwd()}`;

    const platformCtx = platformSystemPrompt();

    const manthraMd = loadManthraMd();
    const projectInstructions = manthraMd
      ? `## Project instructions (MANTHRA.md)\n\n${manthraMd}`
      : null;

    return [base, memory, cwd, platformCtx, projectInstructions].filter(Boolean).join('\n\n');
  }

  // ── Terminal layout (scrolling region + fixed chrome) ────────────────────

  private rows = process.stdout.rows ?? 24;
  private cols = process.stdout.columns ?? 80;
  private readonly CHROME = 3; // rows reserved for fixed chrome

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
    this.cols = process.stdout.columns ?? 80;
    // Set DECSTBM scrolling region — rows 1 to scrollEnd scroll; chrome rows are fixed
    process.stdout.write(`\x1B[1;${this.scrollEnd}r`);
    this.redrawChrome();
    // Position cursor at bottom of scroll region so first output lands there
    process.stdout.write(`\x1B[${this.scrollEnd};1H`);
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

    // Draw all three chrome rows without touching the scroll region
    process.stdout.write('\x1B7');
    process.stdout.write(`\x1B[${s};1H\x1B[2K${statusLine}`);
    process.stdout.write(`\x1B[${inp};1H\x1B[2K`);
    process.stdout.write(`\x1B[${b};1H\x1B[2K${bottomBar}`);
    process.stdout.write('\x1B8');
  }

  // Position cursor for user input and draw prompt
  private openBox(): void {
    if (!this.rl) return;
    if (!process.stdout.isTTY) { process.stdout.write('\n> '); return; }
    this.redrawChrome();
    process.stdout.write(`\x1B[${this.inputRow};1H\x1B[2K`);
    this.rl.setPrompt('  ');
    this.rl.prompt(true);
  }

  // Move cursor into scroll region so response output scrolls there
  private closeBox(): void {
    if (!process.stdout.isTTY) return;
    process.stdout.write(`\x1B[${this.scrollEnd};1H`);
  }

  // ── Slash commands ────────────────────────────────────────────────────────

  private async handleSlashCommand(input: string): Promise<void> {
    const match = input.match(/^\/(\S*)(?:\s+(.*))?$/);
    if (!match) return;
    const [, name, args = ''] = match;
    if (!name) return;

    const command = getCommand(name);
    if (!command) {
      console.log(chalk.dim('\n  Use `manthra web` to configure providers and models.'));
      console.log(chalk.dim('  Type /exit to quit.\n'));
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
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    let usage: { input_tokens: number; output_tokens: number } | undefined;
    let thinkingBuf = '';
    let thinkingStarted = false;

    for await (const event of stream) {
      switch (event.type) {
        case 'thinking_delta':
          if (event.delta) {
            if (!thinkingStarted) {
              stopThinking();
              thinkingStarted = true;
              process.stdout.write('\n  ' + chalk.italic.dim('Thought: '));
            }
            process.stdout.write(chalk.italic.dim(event.delta));
            thinkingBuf += event.delta;
          }
          break;
        case 'text_delta':
          if (event.delta) text += event.delta;
          break;
        case 'tool_call_done':
          if (event.tool_call) {
            toolCalls.push({ id: event.tool_call.id, name: event.tool_call.name, input: event.tool_call.input ?? {} });
          }
          break;
        case 'message_done':
          if (event.usage) usage = event.usage;
          break;
        case 'error':
          stopThinking();
          console.error(chalk.red(`\n  Stream error: ${event.error}`));
          break;
      }
    }

    stopThinking();

    if (thinkingStarted) {
      process.stdout.write('\n');
    }

    // Render formatted response
    if (text) {
      process.stdout.write('\n' + formatMarkdown(text) + '\n');
    }

    return { text, toolCalls, usage };
  }

  private async runTurn(userMessage: string): Promise<{ turnIn: number; turnOut: number }> {
    if (!this.provider) {
      console.log(chalk.yellow('\n  No provider configured. Run `manthra web` to add one.\n'));
      return { turnIn: 0, turnOut: 0 };
    }

    this.history.addUser(userMessage);

    const systemPrompt = this.getSystemPrompt();
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...this.history.get(),
    ];

    let activeTools = getToolDefinitions();
    let iterCount = 0;
    const MAX_ITER = 10;
    let totalIn = 0;
    let totalOut = 0;

    while (iterCount++ < MAX_ITER) {
      let stream: AsyncIterable<StreamEvent>;
      try {
        stream = this.provider.chat(messages, {
          model: this.model,
          maxTokens: getConfig().maxTokens,
          temperature: getConfig().temperature,
          tools: activeTools,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`\n  Provider error: ${msg}`));
        break;
      }

      this.stopThinkingFn = startThinking();
      let text: string, toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>, usage: { input_tokens: number; output_tokens: number } | undefined;
      try {
        ({ text, toolCalls, usage } = await this.processStream(stream, this.stopThinkingFn));
      } catch (err: unknown) {
        if (this.stopThinkingFn) { this.stopThinkingFn(); this.stopThinkingFn = null; }
        const msg = err instanceof Error ? err.message : String(err);
        if (activeTools.length > 0 && /tool|function.call/i.test(msg)) {
          activeTools = [];
          continue;
        }
        console.log(chalk.red(`\n  ${msg}`));
        break;
      }
      this.stopThinkingFn = null;

      if (usage) {
        totalIn += usage.input_tokens ?? 0;
        totalOut += usage.output_tokens ?? 0;
      }

      const assistantContent: ContentBlock[] = [];
      if (text) assistantContent.push({ type: 'text', text });
      for (const tc of toolCalls) {
        assistantContent.push({ type: 'tool_call', id: tc.id, name: tc.name, input: tc.input });
      }

      if (assistantContent.length > 0) {
        messages.push({ role: 'assistant', content: assistantContent });
        this.history.addAssistant(assistantContent);
      }

      if (toolCalls.length === 0) break;

      const toolResults: ContentBlock[] = [];
      for (const tc of toolCalls) {
        const result = await executeTool(tc.name, tc.input);
        toolResults.push({
          type: 'tool_result',
          tool_call_id: tc.id,
          content: result.success ? result.output : `Error: ${result.error}`,
          is_error: !result.success,
        });
      }

      messages.push({ role: 'user', content: toolResults });
      this.history.add({ role: 'user', content: toolResults });
    }

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

    // Show a dim indicator if MANTHRA.md is active
    if (loadManthraMd()) {
      process.stdout.write(chalk.dim(`  ✦  MANTHRA.md loaded\n`));
    }

    // Update scroll region on terminal resize
    process.stdout.on('resize', () => {
      this.rows = process.stdout.rows ?? 24;
      this.cols = process.stdout.columns ?? 80;
      process.stdout.write(`\x1B[1;${this.scrollEnd}r`);
      this.redrawChrome();
      process.stdout.write(`\x1B[${this.inputRow};1H\x1B[2K`);
      this.rl?.prompt(true);
    });

    this.openBox();

    this.rl.on('line', async (raw) => {
      const input = raw.trim();
      this.closeBox(); // position cursor in scroll region

      if (!input) { this.openBox(); return; }

      if (input.startsWith('/')) {
        await this.handleSlashCommand(input);
        this.openBox();
        return;
      }

      this.isProcessing = true;
      this.rl!.pause();
      try {
        const { turnIn, turnOut } = await this.runTurn(input);
        this.sessionIn += turnIn;
        this.sessionOut += turnOut;
      } catch (err: unknown) {
        if (this.stopThinkingFn) { this.stopThinkingFn(); this.stopThinkingFn = null; }
        console.log(chalk.red(`\n  ${err instanceof Error ? err.message : err}`));
      }
      this.isProcessing = false;
      this.rl!.resume();
      this.openBox();
    });

    this.rl.on('close', () => {
      if (process.stdout.isTTY) {
        process.stdout.write('\x1B[r');                      // reset scroll region
        process.stdout.write(`\x1B[${this.rows};1H\n`);     // move below chrome
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
