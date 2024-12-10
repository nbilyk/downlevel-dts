import { downlevelDts } from '../../src';

import * as fs from 'fs';
import { globSync } from 'glob';
import path from 'node:path';

const SRC_DIR = 'test/integ/original';
const OUT_DIR_BASE = 'test/integ/baselines/actual';
const EXPECTED_DIR_BASE = 'test/integ/baselines/expected';

const VERSIONS = [
    '3.4',
    '3.5',
    '3.6',
    '3.7',
    '3.8',
    '3.9',
    '4.0',
    '4.1',
    '4.2',
    '4.3',
    '4.4',
    '4.5',
    '4.6',
    '4.7',
    '4.8',
    '4.9',
    '5.0',
    '5.1',
    '5.2',
    '5.3',
    '5.4',
    '5.5',
    '5.6',
    '5.7',
] as const;

describe('downlevelDts', () => {
    beforeAll(() => {
        fs.rmSync(OUT_DIR_BASE, { recursive: true, force: true });
    }, /* timeout */ 10 * 1000);

    for (const tsVersion of VERSIONS) {
        test(
            `downlevel TS to ${tsVersion}`,
            () => {
                const outDir = `${OUT_DIR_BASE}/ts${tsVersion}`;
                const expectedDir = `${EXPECTED_DIR_BASE}/ts${tsVersion}`;

                downlevelDts(SRC_DIR, outDir, tsVersion);

                const dtsFiles = globSync(`${expectedDir}/**/*.d.ts`);
                if (!dtsFiles.length) fail('d.ts files not found');
                for (const expectedFile of dtsFiles) {
                    const actualFile = path.resolve(
                        outDir,
                        path.relative(expectedDir, expectedFile),
                    );
                    expect(fs.readFileSync(actualFile, 'utf8')).toEqual(
                        fs.readFileSync(expectedFile, 'utf8'),
                    );
                }
            },
            /* timeout */ 10 * 1000,
        );
    }
});
