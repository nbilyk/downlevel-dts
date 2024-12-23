`@nbilyk/downlevel-dts` is a fork of downlevel-dts, continuing on the great work of
Nathan Shively-Sanders. It is restructured to support a larger range of down-levelling semantics.

---

downlevel-dts rewrites .d.ts files created by any version of TypeScript so
that they work with TypeScript 3.4 or later. It does this by
converting code with new features into code that uses equivalent old
features. For example, it rewrites accessors to properties, because
TypeScript didn't support accessors in .d.ts files until 3.6:

```typescript
declare class C {
    get x(): number;
}
```

becomes

```typescript
declare class C {
    readonly x: number;
}
```

Note that not all features can be down-levelled. For example,
TypeScript 4.0 allows spreading multiple tuple type variables, at any
position in a tuple. This is not allowed in previous versions, and is
down-levelled to `any[]`.

## Features

Here is the list of features that are down-levelled:

### `Omit` (3.5)

```typescript
type Less = Omit<T, K>;
```

becomes

```typescript
type Less = Pick<T, Exclude<keyof T, K>>;
```

`Omit` has had non-builtin implementations since TypeScript 2.2, but
became built-in in TypeScript 3.5.

#### Semantics

`Omit` is a type alias, so the downlevel should behave exactly the same.

### Accessors (3.6)

TypeScript prevented accessors from being in .d.ts files until
TypeScript 3.6 because they behave very similarly to properties.
However, they behave differently with inheritance, so the distinction
can be useful.

```typescript
declare class C {
    get x(): number;
}
```

becomes

```typescript
declare class C {
    readonly x: number;
}
```

#### Semantics

The properties emitted downlevel can be overridden in more cases than
the original accessors, so the downlevel d.ts will be less strict. See
[the TypeScript 3.7 release
notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#the-usedefineforclassfields-flag-and-the-declare-property-modifier)
for more detail.

### `asserts` assertion guards (3.7)

TypeScript 3.7 introduced the `asserts` keyword, which provides a way to indicate that a function will throw if a parameter doesn't meet a condition.
This allows TypeScript to understand that whatever condition such a function checks must be true for the remainder of the containing scope.

Since there is no way to model this before 3.7, such functions are down-levelled to return `void`:

```typescript
declare function assertIsString(val: any, msg?: string): asserts val is string;
declare function assert(val: any, msg?: string): asserts val;
```

becomes

```typescript
declare function assertIsString(val: any, msg?: string): void;
declare function assert(val: any, msg?: string): void;
```

### Type-only import/export (3.8)

The downlevel emit is quite simple:

```typescript
import type { T } from 'x';
```

becomes

```typescript
import { T } from 'x';
```

#### Semantics

The downlevel d.ts will be less strict because a class will be
constructable:

```typescript
declare class C {}
export type { C };
```

becomes

```typescript
declare class C {}
export { C };
```

and the latter allows construction:

```typescript
import { C } from 'x';
var c = new C();
```

### `type` modifiers on import/export names (3.7, 4.5)

The downlevel emit depends on the TypeScript target version and whether type and
value imports/exports are mixed.

An import/export declaration with only import/export names that have `type`
modifiers

```typescript
import { type A, type B } from 'x';
export { type A, type B };
```

becomes:

```typescript
// TS 3.8+
import type { A, B } from 'x';
export type { A, B };

// TS 3.7 or less
import { A, B } from 'x';
export { A, B };
```

A mixed import/export declaration

```typescript
import { A, type B } from 'x';
export { A, type B };
```

becomes:

```typescript
// TS 3.8+
import type { B } from 'x';
import { A } from 'x';
export type { B };
export { A };

// TS 3.7 or less
import { A, B } from 'x';
export { A, B };
```

#### Semantics

When an import/export declaration has only import/export names with `type`
modifiers, it is emitted as a type-only import/export declaration for TS 3.8+
and as a value import/export declaration for TS 3.7 or less. The latter will be
less strict (see [type-only import/export](#type-only-importexport-38)).

When type and value imports/exports are mixed, two import/export declarations
are emitted for TS 3.8+, one for type-only imports/exports and another one for
value imports/exports. For TS 3.7 or less, one value import/export declaration
is emitted which will be less strict (see
[type-only import/export](#type-only-importexport-38)).

### ECMAScript #private members (3.8)

TypeScript 3.8 supports the new ECMAScript-standard #private properties in
addition to its compile-time-only private properties. Since neither
are accessible at compile-time, downlevel-dts converts #private
properties to compile-time private properties:

```typescript
declare class C {
    #private;
}
```

It becomes:

```typescript
declare class C {
    private '#private';
}
```

#### Semantics

The standard emit for _any_ class with a #private property just adds a
single `#private` line. Similarly, a class with a private property
adds only the name of the property, but not the type. The d.ts
includes only enough information for consumers to avoid interfering
with the private property:

```typescript
class C {
    #x = 1;
    private y = 2;
}
```

emits

```typescript
declare class C {
    #private;
    private y;
}
```

which then downlevels to

```typescript
declare class C {
    private '#private';
    private y;
}
```

This is incorrect if your class already has a field named `"#private"`.
But you really shouldn't do this!

The downlevel d.ts incorrectly prevents consumers from creating a
private property themselves named `"#private"`. The consumers of the
d.ts **also** shouldn't do this.

### Star Exports (3.8)

TypeScript 3.8 supports the new ECMAScript-standard `export * as namespace` syntax, which is just syntactic sugar for two import/export
statements:

```typescript
export * as ns from 'x';
```

becomes

```typescript
import * as ns_1 from 'x';
export { ns_1 as ns };
```

#### Semantics

The downlevel semantics should be exactly the same as the original.

### Named Tuples (4.0)

TypeScript 4.0 supports naming tuple members:

```typescript
type T = [foo: number, bar: string];
```

becomes

```typescript
type T = [/** foo */ number, /** bar */ string];
```

TypeScript 5.2 allows tuples where named members are mixed.
Prior to 5.2 if some tuple members are named and others are not, they will all
be replaced with unnamed members.

#### Semantics

The downlevel semantics are exactly the same as the original, but
the TypeScript language service won't be able to show the member names.

### Recursive conditional types (4.1)

https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#recursive-conditional-types
Typescript 4.1 supports recursive conditional types.

```typescript
type ElementType<T> = T extends ReadonlyArray<infer U> ? ElementType<U> : T;
```

becomes

```typescript
type ElementType<T> = T extends ReadonlyArray<infer U> ? any : T;
```

#### Semantics

There is not an equivalent in older typescript versions. `any` will be used in the recursive
branches in order to allow compilation.

### `in out T` (4.7)

Typescript 4.7 supports variance annotations on type parameter declarations:

```typescript
interface State<in out T> {
    get: () => T;
    set: (value: T) => void;
}
```

becomes:

```typescript
interface State<T> {
    get: () => T;
    set: (value: T) => void;
}
```

#### Semantics

The downlevel .d.ts omits the variance annotations, which will change the variance in the cases
where they were added because the compiler gets it wrong.

## Target

Since the earliest downlevel feature is from TypeScript 3.5,
downlevel-dts targets TypeScript 3.4 by default. The downlevel target is
configurable with `--to` argument.

Currently, TypeScript 3.0 features like `unknown` are not
down-levelled, nor are there any other plans to support TypeScript 2.x.

### Downlevel semantics

## Usage

Usage: `npx @nbilyk/downlevel-dts src dest [--to=3.4]`

Example: `npx @nbilyk/downlevel-dts ts5.4 ts{VERSION} --to=3.4,4.1,4.8,4.9`

- src - The directory containing the source d.ts files.
- dest - The destination directory. If multiple versions are provided, this must contain a
  `{VERSION}` substitution token. E.g. `dist/ts{VERSION}`
- --to - The version(s) to downlevel to. May be comma-delimited.

To your package.json, add:

_Important Note_: TypeScript 4.9 now correctly prioritizes `exports` over `typesVersions`.
If packaging for <4.9 use typesVersions for backwards compatibility.

```json
{
    "exports": {
        ".": {
            ">=5.4": { ".": ["ts5.4/*"] },
            ">=4.9": { ".": ["ts4.9/*"] }
        }
    },
    "typesVersions": {
        ">=4.8": { ".": ["ts4.8/*"] },
        ">=4.1": { ".": ["ts4.1/*"] },
        ">=3.4": { ".": ["ts3.4/*"] }
    }
}
```
