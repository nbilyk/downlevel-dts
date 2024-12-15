import semver from 'semver';
import { globSync } from 'glob';
import ts from 'typescript';
import { downlevelProgramFiles } from './transformUtils';
import { transformerMap } from './transformers';
import path from 'path';
import fs from 'fs';

export type DownlevelOptions = {
    readonly src: string;
    readonly target: string;
    readonly targetVersion?: string;
};

export function downlevelDts(options: DownlevelOptions) {
    const { src, target } = options;
    if (!src || !target) {
        console.log('Usage: node index.js test test/ts3.4 [--to=3.4]');
        process.exit(1);
    }
    const targetVersion = semver.coerce(options.targetVersion ?? '3.4.0');
    if (!targetVersion) {
        console.error('invalid target version:', options.targetVersion);
        process.exit(1);
    } else if (semver.lt(targetVersion, '3.4.0')) {
        console.error('minimum supported target version is 3.4');
        process.exit(1);
    }

    // Find files matching the pattern while excluding `node_modules`
    const dtsFiles = globSync(`${src}/**/*.d.ts`, {
        ignore: '**/node_modules/**',
    });
    const printer = ts.createPrinter({
        newLine: ts.NewLineKind.CarriageReturnLineFeed,
    });
    const program = ts.createProgram({
        rootNames: dtsFiles,
        options: {},
    });

    for (const sourceFile of downlevelProgramFiles(program, targetVersion, transformerMap)) {
        const targetPath = path.resolve(target, path.relative(src, sourceFile.fileName));
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, dedupeTripleSlash(printer.printFile(sourceFile)));
    }
}

function dedupeTripleSlash(s: string): string {
    const lines = s.split('\n');
    const i = lines.findIndex((line) => !line.startsWith('/// <reference '));
    return [...new Set(lines.slice(0, i)), ...lines.slice(i)].join('\n');
}
