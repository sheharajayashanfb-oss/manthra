import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Tool, ToolResult } from './types.js';

interface NotebookOutput {
  output_type: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  outputs?: NotebookOutput[];
  execution_count?: number | null;
  metadata?: Record<string, unknown>;
}

interface Notebook {
  nbformat: number;
  nbformat_minor: number;
  metadata?: Record<string, unknown>;
  cells: NotebookCell[];
}

function cellSource(cell: NotebookCell): string {
  return Array.isArray(cell.source) ? cell.source.join('') : (cell.source ?? '');
}

function outputText(out: NotebookOutput): string {
  if (out.output_type === 'error') {
    return `[Error] ${out.ename}: ${out.evalue}`;
  }
  const text = out.text ?? out.data?.['text/plain'] ?? out.data?.['text/html'] ?? '';
  return Array.isArray(text) ? text.join('') : (text as string);
}

function formatCell(cell: NotebookCell, index: number): string {
  const type = cell.cell_type === 'code' ? 'Code' : cell.cell_type === 'markdown' ? 'Markdown' : 'Raw';
  const exec = cell.execution_count != null ? ` [${cell.execution_count}]` : '';
  const source = cellSource(cell);

  let out = `--- Cell ${index} (${type}${exec}) ---\n${source}`;

  if (cell.outputs && cell.outputs.length > 0) {
    const outputs = cell.outputs.map(outputText).filter(Boolean).join('\n');
    if (outputs) out += `\n\nOutput:\n${outputs}`;
  }

  return out;
}

export const notebookReadTool: Tool = {
  name: 'notebook_read',
  description: 'Read a Jupyter notebook (.ipynb) file. Returns all cells with their type, source, and outputs. Use this instead of the read tool for .ipynb files.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the .ipynb file' },
      cell_index: { type: 'number', description: 'Index of a specific cell to read (0-based, optional — reads all cells if omitted)' },
    },
    required: ['path'],
  },
  async execute(input): Promise<ToolResult> {
    if (typeof input['path'] !== 'string' || !input['path']) {
      return { success: false, output: '', error: 'path is required and must be a string' };
    }

    const filePath = resolve(process.cwd(), input['path'] as string);

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const nb = JSON.parse(raw) as Notebook;

      if (!Array.isArray(nb.cells)) {
        return { success: false, output: '', error: 'Not a valid Jupyter notebook (no cells array)' };
      }

      const cellIndex = input['cell_index'] as number | undefined;

      if (cellIndex !== undefined) {
        if (cellIndex < 0 || cellIndex >= nb.cells.length) {
          return { success: false, output: '', error: `cell_index ${cellIndex} out of range (notebook has ${nb.cells.length} cells, indices 0–${nb.cells.length - 1})` };
        }
        return { success: true, output: formatCell(nb.cells[cellIndex], cellIndex) };
      }

      const header = `Notebook: ${filePath}\nCells: ${nb.cells.length}  |  Format: nbformat ${nb.nbformat}.${nb.nbformat_minor}\n`;
      const body = nb.cells.map((c, i) => formatCell(c, i)).join('\n\n');
      return { success: true, output: header + '\n' + body };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};

export const notebookEditTool: Tool = {
  name: 'notebook_edit',
  description: 'Edit a cell in a Jupyter notebook (.ipynb) file. Replaces the source of a specific cell by index. Use notebook_read first to see current cell indices and content.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the .ipynb file' },
      cell_index: { type: 'number', description: 'Index of the cell to edit (0-based)' },
      new_source: { type: 'string', description: 'New source content for the cell' },
      cell_type: { type: 'string', description: 'Change cell type: "code", "markdown", or "raw" (optional — keeps existing type if omitted)' },
    },
    required: ['path', 'cell_index', 'new_source'],
  },
  async execute(input): Promise<ToolResult> {
    if (typeof input['path'] !== 'string' || !input['path']) {
      return { success: false, output: '', error: 'path is required and must be a string' };
    }
    if (typeof input['cell_index'] !== 'number') {
      return { success: false, output: '', error: 'cell_index is required and must be a number' };
    }
    if (typeof input['new_source'] !== 'string') {
      return { success: false, output: '', error: 'new_source is required and must be a string' };
    }

    const filePath = resolve(process.cwd(), input['path'] as string);

    if (!existsSync(filePath)) {
      return { success: false, output: '', error: `File not found: ${filePath}` };
    }

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const nb = JSON.parse(raw) as Notebook;

      if (!Array.isArray(nb.cells)) {
        return { success: false, output: '', error: 'Not a valid Jupyter notebook' };
      }

      const idx = input['cell_index'] as number;
      if (idx < 0 || idx >= nb.cells.length) {
        return { success: false, output: '', error: `cell_index ${idx} out of range (${nb.cells.length} cells)` };
      }

      const cell = nb.cells[idx];
      cell.source = input['new_source'] as string;

      const newType = input['cell_type'] as string | undefined;
      if (newType) {
        if (!['code', 'markdown', 'raw'].includes(newType)) {
          return { success: false, output: '', error: 'cell_type must be "code", "markdown", or "raw"' };
        }
        cell.cell_type = newType as 'code' | 'markdown' | 'raw';
        if (newType !== 'code') {
          cell.outputs = [];
          cell.execution_count = null;
        }
      }

      writeFileSync(filePath, JSON.stringify(nb, null, 1), 'utf-8');
      return { success: true, output: `Edited cell ${idx} in ${filePath}` };
    } catch (err: unknown) {
      return { success: false, output: '', error: String(err) };
    }
  },
};
