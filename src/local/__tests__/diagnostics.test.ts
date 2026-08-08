import {
  createDiagnosticRepairInstruction,
  summarizeDiagnostics,
} from '../diagnostics';

describe('diagnostic repair context', () => {
  test('summarizes bounded diagnostics without surrounding source code', () => {
    const diagnostic = {
      range: { start: { line: 2, character: 4 } },
      message: 'Unexpected   nullable\nvalue',
      severity: 1,
      source: 'typescript',
      code: 18047,
    } as never;

    expect(summarizeDiagnostics([diagnostic], 1)).toEqual([
      {
        line: 3,
        column: 5,
        severity: 'warning',
        message: 'Unexpected nullable value',
        source: 'typescript',
        code: '18047',
      },
    ]);
  });

  test('builds a minimal-change instruction and reports omitted diagnostics', () => {
    const instruction = createDiagnosticRepairInstruction(
      [
        {
          line: 1,
          column: 2,
          severity: 'error',
          message: 'Missing return',
        },
      ],
      3
    );
    expect(instruction).toContain('smallest safe change');
    expect(instruction).toContain('error at 1:2: Missing return');
    expect(instruction).toContain('2 additional diagnostic(s)');
  });

  test('rejects an empty diagnostic list', () => {
    expect(() => createDiagnosticRepairInstruction([], 0)).toThrow(
      /no diagnostics/
    );
  });
});
