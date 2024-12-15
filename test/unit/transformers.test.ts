import { expectDownlevelToEqual } from './testUtil';
import { recursiveConditionalTypes } from '../../src/transformers';

describe('recursiveConditionalTypes', () => {
    it('replaces immediate circular references with any', () => {
        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `type RecursiveConditionalType<T> = T extends ReadonlyArray<infer U> ? RecursiveConditionalType<U> : T;`,
            // language=TypeScript
            `type RecursiveConditionalType<T> = T extends ReadonlyArray<infer U> ? any : T;`,
        );

        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `type A<T> = T extends true ? B<T> : never;
            type B<T> = T extends true ? A<T> : never;`,
            // language=TypeScript
            `type A<T> = T extends true ? any : never;
            type B<T> = T extends true ? any : never;`,
        );

        // Both references to B and A are replaced, technically only one does to break the cycle.
        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `type A<T> = T extends true ? B<T> : never;
                type B<T> = A<T>`,
            // language=TypeScript
            `type A<T> = T extends true ? any : never;
                type B<T> = any`,
        );

        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `export type A<T> = T extends true ? B<T> : never;
             export type B<T> = A<T>;`,
            // language=TypeScript
            `export type A<T> = T extends true ? any : never;
             export type B<T> = any;`,
        );

        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `export type A<T> = T extends true ? B<T> : never;
            export type B<T> = C<A<T>>;
            export type C<T> = 2;`,
            // language=TypeScript
            `export type A<T> = T extends true ? B<T> : never;
            export type B<T> = C<any>;
            export type C<T> = 2;`,
        );

        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `export type A<T> = T extends true ? B<T> : never;
            export type B<T> = Array<A<T>>;`,
            // language=TypeScript
            `export type A<T> = T extends true ? B<T> : never;
            export type B<T> = Array<any>;`,
        );

        // This technically doesn't need to be replaced, older compilers don't detect this as circular.
        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `type A<T> = T extends true ? Array<A<T>> : never;`,
            // language=TypeScript
            `type A<T> = T extends true ? Array<any> : never;`,
        );
    });

    it('does not replace non-immediate circular references', () => {
        expectDownlevelToEqual(
            recursiveConditionalTypes,
            // language=TypeScript
            `type A<T> = T extends true ? [A<false>] : T;`,
            // language=TypeScript
            `type A<T> = T extends true ? [A<false>] : T;`,
        );
    });
});
