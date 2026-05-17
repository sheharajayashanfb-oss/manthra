import ora, { type Ora } from 'ora';

let activeSpinner: Ora | null = null;

export function startSpinner(text: string): void {
  if (activeSpinner) activeSpinner.stop();
  activeSpinner = ora({ text, color: 'cyan', spinner: 'dots' }).start();
}

export function updateSpinner(text: string): void {
  if (activeSpinner) activeSpinner.text = text;
}

export function stopSpinner(success?: string, fail?: string): void {
  if (!activeSpinner) return;
  if (success !== undefined) {
    activeSpinner.succeed(success || undefined);
  } else if (fail !== undefined) {
    activeSpinner.fail(fail || undefined);
  } else {
    activeSpinner.stop();
  }
  activeSpinner = null;
}
