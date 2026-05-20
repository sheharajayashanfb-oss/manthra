import type { ConversationHistory } from '../conversation/index.js';
import type { Provider } from '../providers/types.js';

export interface CommandContext {
  history: ConversationHistory;
  provider: Provider | undefined;
  model: string;
  contextWindow?: number;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  handler(args: string, ctx: CommandContext): Promise<void>;
}
