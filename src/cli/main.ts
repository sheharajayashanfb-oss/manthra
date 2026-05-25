#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import minimist from 'minimist';
import chalk from 'chalk';
import { printWelcome } from '../ui/renderer.js';
import { loadConfig } from '../config/loader.js';
import { autoInitProviders } from '../config/auto-init.js';
import { REPL } from './repl.js';
import { setVerbose } from '../tools/executor.js';
import { checkForUpdate } from './update-check.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  // In standalone binary, process.env.APP_VERSION is injected at build time by tsup define.
  // In dev mode, fall back to reading package.json.
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

function printProviderStatus(providers: Array<{ name: string; id: string; type: string; baseURL?: string; enabled: boolean }>): void {
  const active = providers.filter((p) => p.enabled);
  if (active.length === 0) {
    console.log(chalk.yellow('  No providers configured. Run `manthra web` to add one.\n'));
    return;
  }
  console.log(
    chalk.dim('  Providers: ') +
    active.map((p) => chalk.green(`${p.name}${p.baseURL ? ` (${p.baseURL})` : ''}`)).join(chalk.dim(' · ')),
  );
  console.log(chalk.dim('  Run `manthra web` to configure · /exit to quit\n'));
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['help', 'version', 'no-tools', 'verbose'],
    string: ['provider', 'model', 'print'],
    alias: { h: 'help', v: 'version', p: 'provider', m: 'model', V: 'verbose' },
  });

  if (argv['version']) {
    console.log(getVersion());
    process.exit(0);
  }

  if (argv['help']) {
    console.log(`
${chalk.bold('manthra')} — AI coding assistant powered by Ollama

${chalk.bold('Usage:')}
  manthra [options] [message]
  manthra web                  Start the Ollama configuration GUI

${chalk.bold('Options:')}
  -m, --model <id>             Use a specific model
  --print <message>            Run a single prompt and exit (non-interactive)
  -V, --verbose                Show full tool names (developer mode)
  -v, --version                Show version
  -h, --help                   Show this help

${chalk.bold('Examples:')}
  manthra                      Start interactive REPL
  manthra web                  Open configuration GUI
  manthra --print "hello"      Single prompt mode
  manthra -m qwen2.5-coder     Use a specific Ollama model
`);
    process.exit(0);
  }

  if (argv['verbose']) setVerbose(true);

  let config = loadConfig();
  ({ config } = autoInitProviders(config));

  // Handle "manthra web" subcommand
  if (argv._[0] === 'web') {
    const { startServer } = await import('../web/server.js');
    await startServer();
    return;
  }

  printWelcome(getVersion());
  printProviderStatus(config.providers);

  const repl = new REPL();
  const [updateVersion] = await Promise.all([
    checkForUpdate(getVersion()),
    repl.init({
      provider: argv['provider'] as string | undefined,
      model: argv['model'] as string | undefined,
    }),
  ]);

  if (updateVersion) {
    console.log(chalk.yellow(`  Update available: v${getVersion()} → v${updateVersion}`));
    console.log(chalk.dim('  Run: npm update -g manthra\n'));
  }

  // Non-interactive: manthra --print "message"
  const printMsg = argv['print'] as string | undefined;
  if (printMsg) {
    await repl.runOnce(printMsg);
    process.exit(0);
  }

  // Non-interactive: manthra "message"
  const positional = argv._.join(' ');
  if (positional) {
    await repl.runOnce(positional);
    process.exit(0);
  }

  // Interactive REPL
  await repl.run();
}

main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
