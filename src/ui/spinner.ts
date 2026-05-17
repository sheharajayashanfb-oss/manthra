import chalk from 'chalk';

const SPIN = ['⠋', '⠙', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const MAX_LABEL = 72;

/**
 * Animate a one-line spinner on the current stdout line.
 * Returns a stop() that clears the spinner line (cursor stays at col 1).
 * Safe to call in the REPL's DECSTBM scroll region.
 */
export function startSpinner(label: string): () => void {
  if (!process.stdout.isTTY) {
    process.stdout.write(chalk.dim(`  ⟳  ${label}\n`));
    return () => {};
  }

  const short = label.length > MAX_LABEL ? label.slice(0, MAX_LABEL - 1) + '…' : label;
  let si = 0;

  const tick = () => {
    process.stdout.write(`\r  ${chalk.cyan(SPIN[si % SPIN.length])}  ${chalk.dim(short)}     `);
    si++;
  };

  tick();
  const timer = setInterval(tick, 80);

  return () => {
    clearInterval(timer);
    process.stdout.write('\r\x1B[2K'); // clear the spinner line, cursor at col 1
  };
}
