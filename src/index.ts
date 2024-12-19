#!/usr/bin/env node
import { downlevelDts } from './downlevelDts';

// re-export downlevelDts
export { downlevelDts };

if (require.main === module) {
    const src = process.argv[2];
    const target = process.argv[3];
    const to = process.argv.find((arg) => arg.startsWith('--to'));
    if (!src || !target) {
        console.log(`Usage: npx @nbilyk/downlevel-dts src dest [--to=3.4]
src - The directory containing the source d.ts files.
dest - The destination directory. This may contain a {VERSION} substitution token. E.g. dist/types/{VERSION}
--to - The version(s) to downlevel to. May be comma delimited.`);
        process.exit(1);
    }
    let targetVersion: string[] | undefined = undefined;
    if (to) {
        const userInput = to.split('=')[1];
        if (userInput) targetVersion = userInput.split(',');
    }
    downlevelDts({
        src,
        target,
        targetVersion,
    });
}
