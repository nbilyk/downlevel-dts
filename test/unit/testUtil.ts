import ts from 'typescript';
import {
    createRecursiveVisitorFromTransformer,
    type DownlevelVisitor,
    transformProgramFiles,
} from '../../src/transformUtils';
import semver from 'semver';

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

/**
 * Creates a compiler host for a virtual file map.
 *
 * @param fileMap A map of filename to source strings.
 */
export function createVirtualCompilerHost(fileMap: Map<string, string>): ts.CompilerHost {
    return {
        ...ts.createCompilerHost({}),
        getSourceFile: (fileName, languageVersion) => {
            const sourceText = fileMap.get(fileName);
            return sourceText !== undefined
                ? ts.createSourceFile(fileName, sourceText, languageVersion)
                : undefined;
        },
        readFile: (fileName) => fileMap.get(fileName),
        fileExists: (fileName) => fileMap.has(fileName),
    };
}

/**
 * Creates a ts.Program to compile a virtual file map.
 *
 * @param fileMap A map of filename to source strings.
 */
export function createVirtualProgram(fileMap: Map<string, string>): ts.Program {
    return ts.createProgram({
        rootNames: Array.from(fileMap.keys()),
        options: { noEmit: true },
        host: createVirtualCompilerHost(fileMap),
    });
}

export function downlevelSource(transformer: DownlevelVisitor, source: string): ts.SourceFile {
    const program = createVirtualProgram(new Map<string, string>([['temp.ts', source]]));
    return transformProgramFiles(program, (program, transformationContext) => {
        const checker = program.getTypeChecker();
        return createRecursiveVisitorFromTransformer(transformer, {
            checker,
            targetVersion: semver.coerce('3.4')!,
            transformationContext,
        });
    })[0];
}

/**
 * Expects that when the source is down-levelled with the given transformer it will match the expected output.
 */
export function expectDownlevelToEqual(
    transformer: DownlevelVisitor,
    source: string,
    expected: string,
): void {
    expectSourceFileEqualTo(downlevelSource(transformer, source), expected);
}
