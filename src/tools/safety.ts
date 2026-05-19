import * as readline from 'readline';
import chalk from 'chalk';
import type { Tool, ToolResult } from './types.js';

async function promptConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

const confirmActionTool: Tool = {
  name: 'confirm_action',
  description: 'Ask the user to confirm a potentially dangerous or irreversible action before proceeding',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'The action to confirm (short description)' },
      details: { type: 'string', description: 'Additional details about what will happen' },
    },
    required: ['action'],
  },
  async execute(input): Promise<ToolResult> {
    try {
      const action = String(input['action']);
      const details = input['details'] ? String(input['details']) : '';

      process.stdout.write('\n');
      process.stdout.write(chalk.yellow('  ⚠  Confirmation required\n'));
      process.stdout.write(chalk.white(`  Action: ${action}\n`));
      if (details) {
        process.stdout.write(chalk.dim(`  Details: ${details}\n`));
      }
      process.stdout.write('\n');

      const confirmed = await promptConfirmation(chalk.bold('  Proceed? [y/N] '));

      if (confirmed) {
        process.stdout.write(chalk.green('  Confirmed.\n\n'));
        return { success: true, output: `User confirmed: ${action}` };
      } else {
        process.stdout.write(chalk.red('  Cancelled.\n\n'));
        return { success: false, output: '', error: `User denied: ${action}` };
      }
    } catch (err) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

const blockCommandTool: Tool = {
  name: 'block_command',
  description: 'Block a potentially dangerous command and explain why it should not be executed',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'The reason for blocking the command' },
    },
    required: ['reason'],
  },
  async execute(input): Promise<ToolResult> {
    const reason = String(input['reason']);
    process.stdout.write(chalk.red(`\n  ✗  Command blocked: ${reason}\n\n`));
    return { success: false, output: '', error: `Blocked: ${reason}` };
  },
};

export const safetyTools: Tool[] = [confirmActionTool, blockCommandTool];
