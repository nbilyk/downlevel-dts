import ts from 'typescript';
import { getDtsVisitorsToApply, visitDfsPostOrdered } from '../../src/transformUtils';
import { createTempSourceFile, expectSourceFileEqualTo } from './testUtil';
import semver from 'semver';

describe('getDtsVisitorsToApply', () => {
    it('returns a flat list of the dts visitors to apply for a given version', () => {
        const a = (): undefined => {};
        const b = (): undefined => {};
        const c = (): undefined => {};
        const d = (): undefined => {};
        const e = (): undefined => {};
        const m = {
            '3.4.0': [a],
            '3.5.0': [b, c],
            '4.1.0': [d],
            '*': [e],
        };
        expect(getDtsVisitorsToApply(m, semver.coerce('3.3')!)).toEqual([a, b, c, d, e]);
        expect(getDtsVisitorsToApply(m, semver.coerce('3.4')!)).toEqual([b, c, d, e]);
        expect(getDtsVisitorsToApply(m, semver.coerce('3.5')!)).toEqual([d, e]);
        expect(getDtsVisitorsToApply(m, semver.coerce('4.1')!)).toEqual([e]);
        expect(getDtsVisitorsToApply(m, semver.coerce('4.2')!)).toEqual([e]);
    });
});

describe('visitDfsPostOrdered', () => {
    it('recursively visits each node in a breadth-first graph', () => {
        const sourceFile = createTempSourceFile(`type Foo = { bar: string };`);
        const walked: number[] = [];
        visitDfsPostOrdered(sourceFile, (node) => {
            walked.push(node.kind);
            return node;
        });
        expect(walked).toEqual([
            ts.SyntaxKind.Identifier, // Foo
            ts.SyntaxKind.Identifier, // bar
            ts.SyntaxKind.StringKeyword, // string
            ts.SyntaxKind.PropertySignature, // bar: string
            ts.SyntaxKind.TypeLiteral, // { bar: string }
            ts.SyntaxKind.TypeAliasDeclaration, // type Foo = { bar: string };
            ts.SyntaxKind.SourceFile,
        ]);
    });

    it('handles multi-node visit results', () => {
        const sourceFile = createTempSourceFile(`type Foo = { bar: string };`);
        const updatedFile = visitDfsPostOrdered(sourceFile, (node) => {
            if (ts.isPropertySignature(node)) {
                return [node, node];
            } else if (ts.isIdentifier(node) && node.text === 'bar') {
                return ts.factory.createIdentifier(`baz`);
            }
            return node;
        }) as ts.SourceFile;
        expectSourceFileEqualTo(updatedFile, `type Foo = { baz: string; baz: string; };`);
    });
});
