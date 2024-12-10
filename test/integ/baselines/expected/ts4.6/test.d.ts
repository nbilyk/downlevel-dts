/// <reference path="./subdir/test.d.ts" />
export class C {
    protected get p(): number;
    protected set p(value: number);
    public get q(): string;
    private set r(value: boolean);
}
// single line comment
export namespace N {
    abstract class D {
        // preserve getter comment
        get p(): number;
        /** preserve setter comment */
        set p(value: number);
        get q();
        abstract set r(value: boolean);
    }
}
/** is this a single-line comment? */
import type { C as CD } from "./subdir/test";
/** preserve 1 */
import { type C as CD2, type C as CD3 } from "./subdir/test";
/** preserve 2 */
import { C as CD4, type C as CD5 } from "./subdir/test";
/** preserve 3 */
export { type CD2, type CD3 };
/** preserve 4 */
export { CD4, type CD5 };
/** preserve 5 */
export { type C as CD6, type C as CD7 } from "./subdir/test";
/** preserve 6 */
export { C as CD8, type C as CD9 } from "./subdir/test";
// comment
export * as subdir from "./subdir/test";
export interface E {
    a: number;
    b: number;
}
// comment
export type F = Omit<E, 'a'>;
export class G {
    #private;
}
export class H extends G {
    #private;
}
export interface I extends Omit<E, 'a'> {
    version: number;
}
declare function guardIsString(val: any): val is string;
/** side-effects! */
declare function assertIsString(val: any, msg?: string): asserts val is string;
declare function assert(val: any, msg?: string): asserts val;
type J = [
    foo: string,
    bar: number,
    ...arr: boolean[]
];
export * as default from "./subdir/test";
export declare type Asserts<T> = (val: unknown) => asserts val is T;
// Covariant on T
export type Getter<T> = () => T;
// Contravariant on T
export type Setter<T> = (value: T) => void;
// Invariant on T
export interface State<T> {
    get: () => T;
    set: (value: T) => void;
}
export declare const foo: {
    bar: {
        baz: <T>(val: unknown) => asserts val is T;
    };
};
export type IR = IteratorResult<number, string>;
/** Template Literal - supported since 4.1 < should be StringKeyword */
export type TTemplateLiteral = `${string}abc${string}`;
export type TLowercase = Lowercase<'ABC'>;
export type TUppercase = Uppercase<'abc'>;
export type TCapitalize = Capitalize<'abc'>;
export type TUncapitalize = Uncapitalize<'Abc'>;
interface InterfaceWithAccessors {
    get foo(): number;
    set foo(value: number);
    get bar(): number;
    set baz(value: number);
}
type TypeLiteralWithAccessors = {
    get foo(): number;
    set foo(value: number);
    get bar(): number;
    set baz(value: number);
};
export declare const objectLiteralWithAccessors: {
    get foo(): number;
    set foo(value: number);
    get bar(): number;
    set baz(value: number);
};
// Variadic tuple types
type StringsTuple = [
    string,
    string
];
type NumbersTuple = [
    number,
    number
];
type StrStrNumNumBool = [
    ...StringsTuple,
    ...NumbersTuple,
    boolean
];
type ReadonlyStrStrNumNumBool = readonly [
    ...StringsTuple,
    ...NumbersTuple,
    boolean
];
type SpreadAtEnd = readonly [
    boolean,
    /*rest*/ ...StringsTuple
];
type ArraySpreadAtEnd = readonly [
    boolean,
    /*rest*/ ...string[]
];
