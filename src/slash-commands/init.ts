import chalk from 'chalk';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { SlashCommand } from './types.js';
import type { Message } from '../providers/types.js';
import { startSpinner } from '../ui/spinner.js';

const FILENAME = 'AGENTS.md';

// ── project context gathering ─────────────────────────────────────────────

function tryExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function tryRead(path: string, maxLen = 3000): string {
  try {
    return readFileSync(path, 'utf-8').trim().slice(0, maxLen);
  } catch {
    return '';
  }
}

export function gatherContext(cwd: string): string {
  const sections: string[] = [`Project directory: ${cwd}`];

  // File tree — 2 levels deep, skip generated/dependency dirs
  const tree = tryExec(
    'find . -maxdepth 2 ' +
    '-not -path "*/node_modules/*" ' +
    '-not -path "*/.git/*" ' +
    '-not -path "*/dist/*" ' +
    '-not -path "*/dist-pkg/*" ' +
    '-not -path "*/releases/*" ' +
    '-not -path "*/__pycache__/*" ' +
    '-not -path "*/.next/*" ' +
    '-not -path "*/target/*" ' +
    '-not -path "*/vendor/*" ' +
    '| sort',
    cwd
  );
  if (tree) sections.push(`File structure:\n${tree}`);

  // Language/framework manifest files — first match wins per ecosystem
  const manifests = [
    'package.json',
    'pyproject.toml',
    'requirements.txt',
    'Cargo.toml',
    'go.mod',
    'composer.json',
    'build.gradle',
    'pom.xml',
    'Gemfile',
    'mix.exs',
  ];
  for (const f of manifests) {
    const content = tryRead(join(cwd, f), 2000);
    if (content) sections.push(`${f}:\n\`\`\`\n${content}\n\`\`\``);
  }

  // Existing README for extra context
  const readme = tryRead(join(cwd, 'README.md')) || tryRead(join(cwd, 'README'));
  if (readme) sections.push(`README.md:\n${readme}`);

  // Recent git history gives a sense of active work
  const gitLog = tryExec('git log --oneline -15', cwd);
  if (gitLog) sections.push(`Recent git commits:\n${gitLog}`);

  return sections.join('\n\n');
}

// ── prompt ────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You generate AGENTS.md files for software projects.

AGENTS.md is a project briefing loaded automatically into Manthra (an AI coding assistant) at the start of every session. It replaces the need to re-explain the project on each new conversation. Think of it as a persistent memory file — a compact but complete briefing that gives the AI instant project context.

Write AGENTS.md so that an AI reading it cold can immediately:
- Understand what the project does and why
- Know how to build, run, test, and lint it
- Follow the project's conventions and style
- Navigate the key files and directories
- Avoid common mistakes specific to this codebase

Rules:
- Be factual — only describe what is evident from the provided project info
- Be concise — the file is loaded on every session, so every line should earn its place
- Use clean markdown with sections and code blocks where appropriate
- Do not invent commands or structure that isn't visible in the project info`;

export function buildPrompt(context: string): string {
  return `Based on the project information below, generate an AGENTS.md file.

${context}

Generate the AGENTS.md now. Start with # followed by the project name.`;
}

// ── command ───────────────────────────────────────────────────────────────

export const initCommand: SlashCommand = {
  name: 'init',
  description: `Generate a ${FILENAME} project instructions file`,
  usage: '/init [--force]',

  async handler(args, ctx) {
    const cwd = process.cwd();
    const outPath = join(cwd, FILENAME);
    const force = args.trim() === '--force';

    if (existsSync(outPath) && !force) {
      console.log(chalk.yellow(`\n  ${FILENAME} already exists.`));
      console.log(chalk.dim(`  Use /init --force to regenerate it.\n`));
      return;
    }

    if (!ctx.provider) {
      console.log(chalk.red('\n  No provider configured. Run `manthra web` to set one up.\n'));
      return;
    }

    // ── analyze ───────────────────────────────────────────────────────────
    const stopAnalyze = startSpinner(`Analyzing ${cwd}…`);
    const context = gatherContext(cwd);
    stopAnalyze();

    const messages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: buildPrompt(context) },
    ];

    // ── generate ──────────────────────────────────────────────────────────
    let content = '';
    let firstToken = false;
    const stopGen = startSpinner(`Generating ${FILENAME}…`);

    try {
      const stream = ctx.provider.chat(messages, {
        model: ctx.model,
        maxTokens: 4096,
        temperature: 0,
        tools: [],
      });

      for await (const event of stream) {
        if (event.type === 'text_delta' && event.delta) {
          if (!firstToken) {
            stopGen();             // clear spinner when first token arrives
            firstToken = true;
            process.stdout.write('\n');
          }
          process.stdout.write(event.delta);
          content += event.delta;
        }
      }

      if (!firstToken) stopGen(); // nothing streamed — clear spinner anyway
    } catch (err: unknown) {
      if (!firstToken) stopGen();
      console.log(chalk.red(`\n\n  Generation failed: ${err instanceof Error ? err.message : String(err)}\n`));
      return;
    }

    if (!content.trim()) {
      console.log(chalk.red('\n  No content was generated.\n'));
      return;
    }

    if (!content.endsWith('\n')) content += '\n';
    writeFileSync(outPath, content, 'utf-8');

    console.log(chalk.green(`\n\n  ✓  Saved ${FILENAME}`));
    console.log(chalk.dim(`     Manthra will load it automatically on every session in this directory.\n`));
  },
};
