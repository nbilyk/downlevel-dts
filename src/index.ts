#!/usr/bin/env node
import { downlevelDts } from './downlevelDts';

// re-export downlevelDts
export { downlevelDts };

if (require.main === module) {
    const src = process.argv[2];
    const target = process.argv[3];
    const to = process.argv.find((arg) => arg.startsWith('--to'));
    let targetVersion = '3.4.0';
    if (to) {
        const userInput = to.split('=')[1];
        if (userInput) targetVersion = userInput;
    }
    downlevelDts({
        src,
        target,
        targetVersion,
    });
}
