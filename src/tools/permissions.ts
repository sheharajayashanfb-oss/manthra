import * as readline from 'readline';
import chalk from 'chalk';
import type { Permission } from '../config/types.js';
import { getConfig, updateConfig } from '../config/loader.js';

const sessionPermissions = new Map<string, 'allow' | 'deny'>();

export function getPermission(toolName: string): Permission {
  const config = getConfig();
  return config.permissions[toolName] ?? 'ask';
}

export async function checkPermission(
  toolName: string,
  input: Record<string, unknown>,
  formatDescription?: (input: Record<string, unknown>) => string,
): Promise<boolean> {
  const perm = getPermission(toolName);

  if (perm === 'allow-always') return true;
  if (perm === 'deny-always') return false;

  const sessionPerm = sessionPermissions.get(toolName);
  if (sessionPerm === 'allow') return true;
  if (sessionPerm === 'deny') return false;

  if (perm === 'allow-session') return true;
  if (perm === 'deny-session') return false;

  // Ask the user
  const desc = formatDescription ? formatDescription(input) : JSON.stringify(input, null, 2);
  console.log('\n' + chalk.yellow('⚠  Tool call requires permission:'));
  console.log(chalk.bold(`   Tool: ${toolName}`));
  console.log(chalk.gray(`   Input: ${desc}`));
  console.log(chalk.cyan('   [y] Allow once  [a] Always allow  [s] Allow this session  [n] Deny  [!] Always deny'));

  const answer = await prompt('   Choice: ');
  const choice = answer.trim().toLowerCase();

  switch (choice) {
    case 'y':
    case '':
      return true;
    case 'a':
      updateConfig({ permissions: { ...getConfig().permissions, [toolName]: 'allow-always' } });
      return true;
    case 's':
      sessionPermissions.set(toolName, 'allow');
      return true;
    case 'n':
      return false;
    case '!':
      updateConfig({ permissions: { ...getConfig().permissions, [toolName]: 'deny-always' } });
      return false;
    default:
      return false;
  }
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
