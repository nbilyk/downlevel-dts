export class C {
    get p(): number;
    set p(value: number);
    get q(): string;
    set r(value: boolean);
}
export namespace N {
    class D {
        get p(): number;
        set p(value: number);
        get q(): string;
        set r(value: boolean);
    }
}
export { C as CAlias };
export interface E {
    a: number;
    b: number;
}
