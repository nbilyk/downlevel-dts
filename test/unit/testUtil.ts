import ts from 'typescript';

/**
 * Creates a source file node with default parameters.
 */
export function createTempSourceFile(source: string): ts.SourceFile {
    return ts.createSourceFile('test.d.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

const printer = ts.createPrinter();

/**
 * Prints a node with default parameters.
 */
export function printSource(node: ts.SourceFile): string {
    return printer.printNode(ts.EmitHint.Unspecified, node, node);
}

/**
 * Compares a source node to an expected output.
 * Whitespace differences are ignored.
 */
export function expectSourceFileEqualTo(node: ts.SourceFile | undefined, expectedSource: string) {
    expect(node).toBeDefined();
    const expected = createTempSourceFile(expectedSource);
    expect(printSource(node!)).toEqual(printSource(expected));
}
