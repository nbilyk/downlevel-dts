import semver from 'semver';
import { globSync } from 'glob';
import ts from 'typescript';
import { downlevelProgramFiles } from './transformUtils';
import { transformerMap } from './transformers';
import path from 'path';
import fs from 'fs';

export type DownlevelOptions = {
    /**
     * The source directory with d.ts files.
     */
    readonly src: string;

    /**
     * The output directory. May contain the token `{VERSION}` to replace with the version.
     */
    readonly target: string;

    /**
     * The target version(s) to transpile down to. Default is `[3.4]`.
     */
    readonly targetVersion?: string | readonly string[] | undefined;

    /**
     * The line ending style to use in output files. Default is `LF`.
     */
    readonly newLine?: 'CRLF' | 'LF' | undefined;
};

export function downlevelDts(options: DownlevelOptions) {
    const { src, target } = options;
    const targetVersions = Array.isArray(options.targetVersion)
        ? options.targetVersion
        : [options.targetVersion ?? '3.4.0'];

    // Find files matching the pattern while excluding `node_modules`
    const dtsFiles = globSync(`${src}/**/*.d.ts`, {
        ignore: '**/node_modules/**',
    });
    ts.convertCompilerOptionsFromJson;
    const newLineOption = options.newLine ? options.newLine : 'LF';
    const printer = ts.createPrinter({
        newLine:
            newLineOption === 'CRLF'
                ? ts.NewLineKind.CarriageReturnLineFeed
                : ts.NewLineKind.LineFeed,
    });
    const program = ts.createProgram({
        rootNames: dtsFiles,
        options: {},
    });
    if (targetVersions.length > 1 && !target.includes('{VERSION}')) {
        throw new Error(
            'If multiple target versions are supplied, a {VERSION} token must be set in the target path.',
        );
    }
    for (const targetVersionStr of targetVersions) {
        const targetVersion = semver.coerce(targetVersionStr);
        if (!targetVersion) throw new Error(`version ${targetVersionStr} is invalid.`);
        const outDir = target.replace('{VERSION}', targetVersionStr);
        for (const sourceFile of downlevelProgramFiles(program, targetVersion, transformerMap)) {
            const targetPath = path.resolve(outDir, path.relative(src, sourceFile.fileName));
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, dedupeTripleSlash(printer.printFile(sourceFile)));
        }
    }
}

function dedupeTripleSlash(s: string): string {
    const lines = s.split('\n');
    const i = lines.findIndex((line) => !line.startsWith('/// <reference '));
    return [...new Set(lines.slice(0, i)), ...lines.slice(i)].join('\n');
}
