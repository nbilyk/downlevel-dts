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
/*preserve 1 */
import type { C as CD2, C as CD3 } from "./subdir/test";
/*preserve 2 */
import type { C as CD5 } from "./subdir/test";
import { C as CD4 } from "./subdir/test";
/*preserve 3 */
export type { CD2, CD3 };
/*preserve 4 */
export type { CD5 };
export { CD4 };
/*preserve 5 */
export type { C as CD6, C as CD7 } from "./subdir/test";
/*preserve 6 */
export type { C as CD9 } from "./subdir/test";
export { C as CD8 } from "./subdir/test";
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
// 4.0, named tuples
type NamedTuple = [
    foo: string,
    bar: number
];
type NestedNamedTuple = [
    foo: string,
    bar: number,
    baz: [
        foo: string,
        bar: number
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
export class ClassWithAccessors {
    get foo(): number;
    set foo(value: number);
    get bar(): number;
    // getter is assignable to setter type
    get biz(): number;
    set biz(value: number | string);
    // getter is not assignable to setter type
    get nim(): number;
    set nim(value: number | string);
}
export interface InterfaceWithAccessors {
    get foo(): number;
    set foo(value: number);
    get bar(): number;
    // getter is assignable to setter type
    get biz(): number;
    set biz(value: number | string);
    // getter is not assignable to setter type
    get nim(): number;
    set nim(value: number | string);
}
export type TypeLiteralWithAccessors = {
    get foo(): number;
    set foo(value: number);
    get bar(): number;
    // getter is assignable to setter type
    get biz(): number;
    set biz(value: number | string);
    // getter is not assignable to setter type
    get nim(): number;
    set nim(value: number | string);
};
export declare const objectLiteralWithAccessors: {
    get foo(): number;
    set foo(value: number);
    get bar(): number;
    // getter is assignable to setter type
    get biz(): number;
    set biz(value: number | string);
    // getter is not assignable to setter type
    get nim(): number;
    set nim(value: number | string);
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
export type StrStrNumNumBool = [
    ...StringsTuple,
    ...NumbersTuple,
    boolean
];
export type ReadonlyStrStrNumNumBool = readonly [
    ...StringsTuple,
    ...NumbersTuple,
    boolean
];
export type SpreadAtEnd = readonly [
    boolean,
    ...StringsTuple
];
export type ArraySpreadAtEnd = readonly [
    boolean,
    ...string[]
];
