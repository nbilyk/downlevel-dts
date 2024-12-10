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
import { C as CD } from "./subdir/test";
/*preserve 1 */
import { C as CD2, C as CD3 } from "./subdir/test";
/*preserve 2 */
import { C as CD4, C as CD5 } from "./subdir/test";
/*preserve 3 */
export { CD2, CD3 };
/*preserve 4 */
export { CD4, CD5 };
/*preserve 5 */
export { C as CD6, C as CD7 } from "./subdir/test";
/*preserve 6 */
export { C as CD8, C as CD9 } from "./subdir/test";
import * as subdir_1 from "./subdir/test";
//comment
export { subdir_1 as subdir };
export interface E {
    a: number;
    b: number;
}
// comment
export type F = Omit<E, 'a'>;
export class G {
    private "G.#private";
}
export class H extends G {
    private "H.#private";
}
export interface I extends Omit<E, 'a'> {
    version: number;
}
declare function guardIsString(val: any): val is string;
/** side-effects! */
declare function assertIsString(val: any, msg?: string): asserts val is string;
declare function assert(val: any, msg?: string): asserts val;
type J = any[];
import * as default_1 from "./subdir/test";
export { default_1 as default };
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
export type TTemplateLiteral = string;
export type TLowercase = string;
export type TUppercase = string;
export type TCapitalize = string;
export type TUncapitalize = string;
interface InterfaceWithAccessors {
    foo: number;
    readonly bar: number;
    baz: number;
}
type TypeLiteralWithAccessors = {
    foo: number;
    readonly bar: number;
    baz: number;
};
export declare const objectLiteralWithAccessors: {
    foo: number;
    readonly bar: number;
    baz: number;
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
type StrStrNumNumBool = any[];
type ReadonlyStrStrNumNumBool = readonly any[];
type SpreadAtEnd = readonly any[];
type ArraySpreadAtEnd = readonly any[];
