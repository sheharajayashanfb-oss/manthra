import type { Tool } from './types.js';
import type { ToolDefinition } from '../providers/types.js';
import { fsTools } from './fs.js';
import { searchTools } from './search.js';
import { shellTools } from './shell.js';
import { gitTools } from './git.js';
import { webTools } from './web.js';
import { agentTools } from './agent.js';
import { buildTools } from './build.js';
import { infraTools } from './infra.js';
import { dbTools } from './db.js';
import { safetyTools } from './safety.js';

const allTools: Tool[] = [
  ...fsTools,
  ...searchTools,
  ...shellTools,
  ...gitTools,
  ...webTools,
  ...agentTools,
  ...buildTools,
  ...infraTools,
  ...dbTools,
  ...safetyTools,
];

const toolMap = new Map<string, Tool>(allTools.map((t) => [t.name, t]));

export function getTool(name: string): Tool | undefined {
  return toolMap.get(name);
}

export function getAllTools(): Tool[] {
  return allTools;
}

/** Flat ToolDefinition[] compatible with ChatOptions.tools */
export function getToolDefinitions(): ToolDefinition[] {
  return allTools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Tool['parameters'];
  };
}

/** Ollama-wrapped format (used internally by OllamaProvider) */
export function getOllamaToolDefinitions(): OllamaToolDefinition[] {
  return allTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
