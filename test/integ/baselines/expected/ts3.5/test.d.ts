/// <reference path="./subdir/test.d.ts" />
export class C {
    protected p: number;
    public readonly q: string;
    private r: boolean;
}
// single line comment
export namespace N {
    abstract class D {
        /*preserve getter comment
        preserve setter comment */
        p: number;
        readonly q: any;
        abstract r: boolean;
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
declare function assertIsString(val: any, msg?: string): void;
declare function assert(val: any, msg?: string): void;
// 4.0, named tuples
type NamedTuple = [
    /*foo*/ string,
    /*bar*/ number
];
type NestedNamedTuple = [
    /*foo*/ string,
    /*bar*/ number,
    /*baz*/ [
        /*foo*/ string,
        /*bar*/ number
    ]
];
// 5.2 mixed named tuples
type MixedNamedTuple = [
    /*foo*/ string,
    number
];
type NestedMixedNamedTuple = [
    [
        /*foo*/ string,
        number
    ],
    /*named*/ [
        string,
        /*bar*/ number
    ]
];
import * as default_1 from "./subdir/test";
export { default_1 as default };
export declare type Asserts<T> = (val: unknown) => void;
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
        baz: <T>(val: unknown) => void;
    };
};
export type IR = IteratorResult<number>;
/** Template Literal - supported since 4.1 < should be StringKeyword */
export type TTemplateLiteral = string;
export type TLowercase = string;
export type TUppercase = string;
export type TCapitalize = string;
export type TUncapitalize = string;
export class ClassWithAccessors {
    foo: number;
    readonly bar: number;
    //getter is assignable to setter type
    biz: number | (number | string);
    //getter is not assignable to setter type
    nim: number | string;
}
export interface InterfaceWithAccessors {
    foo: number;
    readonly bar: number;
    //getter is assignable to setter type
    biz: number | (number | string);
    //getter is not assignable to setter type
    nim: number | string;
}
export type TypeLiteralWithAccessors = {
    foo: number;
    readonly bar: number;
    //getter is assignable to setter type
    biz: number | (number | string);
    //getter is not assignable to setter type
    nim: number | string;
};
export declare const objectLiteralWithAccessors: {
    foo: number;
    readonly bar: number;
    //getter is assignable to setter type
    biz: number | (number | string);
    //getter is not assignable to setter type
    nim: number | string;
};
// Variadic tuple types >= 4.0
export type StringsTuple = [
    string,
    string
];
export type NumbersTuple = [
    number,
    number
];
export type StrStrNumNumBool = any[];
export type ReadonlyStrStrNumNumBool = readonly any[];
export type SpreadAtEnd = readonly any[];
export type ArraySpreadAtEnd = readonly any[];
