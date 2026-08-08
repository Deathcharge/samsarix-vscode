import type * as vscode from 'vscode';

export interface DiagnosticSummary {
  line: number;
  column: number;
  severity: string;
  message: string;
  source?: string;
  code?: string;
}

const severityLabels = ['error', 'warning', 'information', 'hint'] as const;

export function summarizeDiagnostics(
  diagnostics: readonly vscode.Diagnostic[],
  maximum = 25
): DiagnosticSummary[] {
  return diagnostics.slice(0, maximum).map(diagnostic => ({
    line: diagnostic.range.start.line + 1,
    column: diagnostic.range.start.character + 1,
    severity: severityLabels[diagnostic.severity] ?? 'unknown',
    message: diagnostic.message.replace(/\s+/g, ' ').trim(),
    ...(diagnostic.source ? { source: diagnostic.source } : {}),
    ...(diagnostic.code !== undefined
      ? {
          code:
            typeof diagnostic.code === 'object'
              ? String(diagnostic.code.value)
              : String(diagnostic.code),
        }
      : {}),
  }));
}

export function createDiagnosticRepairInstruction(
  summaries: readonly DiagnosticSummary[],
  totalCount: number
): string {
  if (summaries.length === 0) {
    throw new Error('The active file has no diagnostics to repair.');
  }
  const lines = summaries.map(item => {
    const origin = [item.source, item.code].filter(Boolean).join(' ');
    return `- ${item.severity} at ${item.line}:${item.column}${origin ? ` (${origin})` : ''}: ${item.message}`;
  });
  const omitted = Math.max(0, totalCount - summaries.length);
  return [
    'Repair the diagnostics listed below with the smallest safe change. Preserve behavior unrelated to the diagnostics. Do not suppress or disable checks unless that is the only correct fix.',
    '',
    ...lines,
    ...(omitted ? [`- …and ${omitted} additional diagnostic(s) not included; avoid unrelated changes.`] : []),
  ].join('\n');
}
