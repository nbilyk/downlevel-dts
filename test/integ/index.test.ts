import { main } from '@src/index';

import * as fs from 'fs';
import * as semver from 'semver';
import { globSync } from 'glob';
import path from 'path';

const SRC_DIR = 'test/integ/original';
const OUT_DIR_BASE = 'test/integ/baselines/actual';
const EXPECTED_DIR_BASE = 'test/integ/baselines/reference';

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
] as const;

describe('main', () => {
    beforeAll(() => {
        fs.rmSync(OUT_DIR_BASE, { recursive: true, force: true })
    }, /* timeout */ 10 * 1000);

    for (const tsVersion of VERSIONS) {
        test(
            `downlevel TS to ${tsVersion}`,
            () => {
                const outDir = `${OUT_DIR_BASE}/ts${tsVersion}`;
                const expectedDir = `${EXPECTED_DIR_BASE}/ts${tsVersion}`;

                main(SRC_DIR, outDir, semver.coerce(tsVersion)!);

                for (const expectedFile of globSync(
                    `${EXPECTED_DIR_BASE}/ts${tsVersion}/**/*.d.ts`,
                )) {
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
