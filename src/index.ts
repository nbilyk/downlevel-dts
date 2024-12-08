#!/usr/bin/env node
import semver, { SemVer } from 'semver';
import path from 'path';
import ts, {
    type AccessorDeclaration,
    type ClassElement,
    type Expression,
    type ExpressionWithTypeArguments,
    type NamedExportBindings,
    type NamedTupleMember,
    type NamespaceExport,
    type Node,
    type NodeArray,
    type ObjectLiteralElementLike,
    type SourceFile,
    SyntaxKind,
    type TransformationContext,
    type Transformer,
    type TransformerFactory,
    type TypeChecker,
    type TypeElement,
    type TypeNode,
    type TypeReferenceNode,
} from 'typescript';
import fs from 'fs';
import { globSync } from 'glob';

export function downlevelDts(src: string, target: string, targetVersionStr = '3.4') {
    if (!src || !target) {
        console.log('Usage: node index.js test test/ts3.4 [--to=3.4]');
        process.exit(1);
    }
    const targetVersion = semver.coerce(targetVersionStr);
    if (!targetVersion) {
        console.error('invalid target version:', targetVersionStr);
        process.exit(1);
    } else if (semver.lt(targetVersion, '3.4.0')) {
        console.error('minimum supported target version is 3.4');
        process.exit(1);
    }

    // Find files matching the pattern while excluding `node_modules`
    const dtsFiles = globSync(`${src}/**/*.d.ts`, {
        ignore: '**/node_modules/**',
    });
    const program = ts.createProgram(dtsFiles, {});
    const checker = program.getTypeChecker(); // just used for setting parent pointers right now
    const files = mapDefined(program.getRootFileNames(), program.getSourceFile);
    const printer = ts.createPrinter({
        newLine: ts.NewLineKind.CarriageReturnLineFeed,
    });

    //

    const transformerFactory: TransformerFactory<SourceFile> = (context) =>
        createSourceFileTransformer(checker, targetVersion, context);
    for (const t of ts.transform(files, [transformerFactory]).transformed) {
        if (t.kind === ts.SyntaxKind.SourceFile) {
            const sourceFile = t as SourceFile;
            const targetPath = path.join(
                target,
                path.resolve(sourceFile.fileName).slice(path.resolve(src).length),
            );
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, dedupeTripleSlash(printer.printFile(sourceFile)));
        }
    }
}

if (require.main === module) {
    const src = process.argv[2];
    const target = process.argv[3];
    const to = process.argv.find((arg) => arg.startsWith('--to'));
    let targetVersion = '3.4.0';
    if (to) {
        const userInput = to.split('=')[1];
        if (userInput) targetVersion = userInput;
    }
    downlevelDts(src, target, targetVersion);
}

type NamespaceReexport = ts.ExportDeclaration & {
    readonly exportClause: NamespaceExport;
    readonly moduleSpecifier: Expression;
};

/**
 * Returns true if the node is a namespace re-export, e.g.
 * export * as ns from 'x'
 */
function isNamespaceReexport(n: Node): n is NamespaceReexport {
    return (
        ts.isExportDeclaration(n) &&
        n.exportClause != null &&
        n.moduleSpecifier != null &&
        ts.isNamespaceExport(n.exportClause)
    );
}

/**
 * Converts a namespace reexport to an import followed by an export.
 * E.g.
 * export * as ns from 'x'
 * =>
 * ```
 * import * as ns_1 from 'x'
 * export { ns_1 as ns }
 * ```
 * @param n
 */
function convertNamespaceReexport(n: NamespaceReexport) {
    const tempName = ts.factory.createUniqueName(n.exportClause.name.getText());
    return [
        ts.factory.createImportDeclaration(
            n.modifiers,
            ts.factory.createImportClause(
                false,
                /*name*/ undefined,
                ts.factory.createNamespaceImport(tempName),
            ),
            n.moduleSpecifier,
        ),
        copyComments(
            [n],
            ts.factory.createExportDeclaration(
                undefined,
                false,
                ts.factory.createNamedExports([
                    ts.factory.createExportSpecifier(false, tempName, n.exportClause.name),
                ]),
            ),
        ),
    ];
}

function createSourceFileTransformer(
    checker: TypeChecker,
    targetVersion: SemVer,
    k: TransformationContext,
): Transformer<SourceFile> {
    const nodeVisitor: ts.Visitor = (n) => {
        if (semver.lt(targetVersion, '3.5.0')) {
            if (isTypeReference(n, 'Omit')) {
                const symbol = checker.getSymbolAtLocation(
                    ts.isTypeReferenceNode(n) ? n.typeName : n.expression,
                );
                const typeArguments = n.typeArguments;

                if (isStdLibSymbol(symbol) && typeArguments) {
                    return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Pick'), [
                        typeArguments[0],
                        ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Exclude'), [
                            ts.factory.createTypeOperatorNode(
                                ts.SyntaxKind.KeyOfKeyword,
                                typeArguments[0],
                            ),
                            typeArguments[1],
                        ]),
                    ]);
                }
            }
        }

        if (semver.lt(targetVersion, '3.6.0')) {
            if (ts.isAccessor(n)) return convertAccessorToProperty(n);

            if (isTypeReference(n, 'IteratorResult')) {
                const symbol = checker.getSymbolAtLocation(
                    ts.isTypeReferenceNode(n) ? n.typeName : n.expression,
                );
                const typeArguments = n.typeArguments;
                if (isStdLibSymbol(symbol) && typeArguments) {
                    return ts.factory.createTypeReferenceNode(
                        ts.factory.createIdentifier('IteratorResult'),
                        [typeArguments[0]],
                    );
                }
            }
        }

        if (semver.lt(targetVersion, '3.7.0')) {
            if (
                ts.isFunctionTypeNode(n) &&
                n.type &&
                ts.isTypePredicateNode(n.type) &&
                n.type.assertsModifier
            ) {
                return ts.factory.createFunctionTypeNode(
                    n.typeParameters,
                    n.parameters,
                    ts.factory.createTypeReferenceNode('void', undefined),
                );
            }

            if (
                ts.isFunctionDeclaration(n) &&
                n.type &&
                ts.isTypePredicateNode(n.type) &&
                n.type.assertsModifier
            ) {
                return ts.factory.createFunctionDeclaration(
                    n.modifiers,
                    n.asteriskToken,
                    n.name,
                    n.typeParameters,
                    n.parameters,
                    ts.factory.createTypeReferenceNode('void', undefined),
                    n.body,
                );
            }
        }

        if (semver.lt(targetVersion, '3.8.0')) {
            if (
                ts.isPropertyDeclaration(n) &&
                ts.isPrivateIdentifier(n.name) &&
                n.name.escapedText === '#private'
            ) {
                // #private => private "#private"
                const modifiers = ts.factory.createModifiersFromModifierFlags(
                    ts.ModifierFlags.Private,
                );
                const parentName = n.parent.name ? n.parent.name.escapedText : '(anonymous)';
                return ts.factory.createPropertyDeclaration(
                    modifiers,
                    ts.factory.createStringLiteral(parentName + '.#private'),
                    /*?! token*/ undefined,
                    /*type*/ undefined,
                    /*initialiser*/ undefined,
                );
            }
            if (isNamespaceReexport(n)) {
                return convertNamespaceReexport(n);
            }
            if (ts.isExportDeclaration(n) && n.isTypeOnly) {
                return ts.factory.createExportDeclaration(
                    n.modifiers,
                    false,
                    n.exportClause,
                    n.moduleSpecifier,
                );
            } else if (ts.isImportClause(n) && n.isTypeOnly) {
                return ts.factory.createImportClause(false, n.name, n.namedBindings);
            }
        }

        if (semver.lt(targetVersion, '4.0.0')) {
            if (n.kind === ts.SyntaxKind.NamedTupleMember) {
                const member = n as NamedTupleMember;
                return ts.addSyntheticLeadingComment(
                    member.dotDotDotToken
                        ? ts.factory.createRestTypeNode(member.type)
                        : member.type,
                    ts.SyntaxKind.MultiLineCommentTrivia,
                    ts.unescapeLeadingUnderscores(member.name.escapedText),
                    /*hasTrailingNewline*/ false,
                );
            }
        }

        if (semver.lt(targetVersion, '4.1.0')) {
            if (n.kind === ts.SyntaxKind.TemplateLiteralType) {
                // TemplateLiteralType added in 4.2
                // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#template-literal-types
                return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
            }
            if (isNamespaceReexport(n) && n.exportClause.name.getText() === 'default') {
                return convertNamespaceReexport(n);
            }
        }

        if (semver.lt(targetVersion, '4.3.2')) {
            if (
                ts.isAccessor(n) &&
                (ts.isInterfaceDeclaration(n.parent) ||
                    ts.isObjectLiteralElement(n.parent) ||
                    ts.isTypeLiteralNode(n.parent))
            ) {
                return convertAccessorToProperty(n);
            }
        }

        if (semver.lt(targetVersion, '4.5.0')) {
            if (
                ts.isImportDeclaration(n) &&
                !n.modifiers &&
                n.importClause &&
                !n.importClause.isTypeOnly &&
                n.importClause.namedBindings &&
                ts.isNamedImports(n.importClause.namedBindings) &&
                n.importClause.namedBindings.elements.some((e) => e.isTypeOnly)
            ) {
                const elements = n.importClause.namedBindings.elements;

                if (semver.lt(targetVersion, '3.8.0')) {
                    // import { A, type B } from 'x'
                    // =>
                    // import { A, B } from 'x'
                    return copyComments(
                        [n],
                        ts.factory.createImportDeclaration(
                            n.modifiers,
                            ts.factory.createImportClause(
                                false,
                                n.importClause.name,
                                ts.factory.createNamedImports(
                                    elements.map((e) =>
                                        ts.factory.createImportSpecifier(
                                            false,
                                            e.propertyName,
                                            e.name,
                                        ),
                                    ),
                                ),
                            ),
                            n.moduleSpecifier,
                        ),
                    );
                }

                const typeElements = [];
                const valueElements = [];
                for (const e of elements) {
                    if (e.isTypeOnly) {
                        typeElements.push(e);
                    } else {
                        valueElements.push(e);
                    }
                }

                // import { type A, type B, ... } from 'x'
                // =>
                // import type { A, B } from 'x'
                const typeOnlyImportDeclaration = copyComments(
                    [n],
                    ts.factory.createImportDeclaration(
                        n.modifiers,
                        ts.factory.createImportClause(
                            true,
                            n.importClause.name,
                            ts.factory.createNamedImports(
                                typeElements.map((e) =>
                                    ts.factory.createImportSpecifier(false, e.propertyName, e.name),
                                ),
                            ),
                        ),
                        n.moduleSpecifier,
                    ),
                );

                if (valueElements.length === 0) {
                    // import { type A, type B } from 'x'
                    // =>
                    // import type { A, B } from 'x'
                    return typeOnlyImportDeclaration;
                } else {
                    // import { A, type B } from 'x'
                    // =>
                    // import type { B } from 'x'
                    // import { A } from 'x'
                    return [
                        typeOnlyImportDeclaration,
                        ts.factory.createImportDeclaration(
                            n.modifiers,
                            ts.factory.createImportClause(
                                false,
                                n.importClause.name,
                                ts.factory.createNamedImports(
                                    valueElements.map((e) =>
                                        ts.factory.createImportSpecifier(
                                            false,
                                            e.propertyName,
                                            e.name,
                                        ),
                                    ),
                                ),
                            ),
                            n.moduleSpecifier,
                        ),
                    ];
                }
            }

            if (
                ts.isExportDeclaration(n) &&
                !n.modifiers &&
                !n.isTypeOnly &&
                n.exportClause &&
                ts.isNamedExports(n.exportClause) &&
                n.exportClause.elements.some((e) => e.isTypeOnly)
            ) {
                const elements = n.exportClause.elements;

                if (semver.lt(targetVersion, '3.8.0')) {
                    // export { A, type B }
                    // export { C, type D } from 'x'
                    // =>
                    // export { A, B }
                    // export { C, D } from 'x'
                    return copyComments(
                        [n],
                        ts.factory.createExportDeclaration(
                            n.modifiers,
                            false,
                            ts.factory.createNamedExports(
                                elements.map((e) =>
                                    ts.factory.createExportSpecifier(false, e.propertyName, e.name),
                                ),
                            ),
                            n.moduleSpecifier,
                        ),
                    );
                }

                const typeElements = [];
                const valueElements = [];
                for (const e of elements) {
                    if (e.isTypeOnly) {
                        typeElements.push(e);
                    } else {
                        valueElements.push(e);
                    }
                }

                // export { type A, type B, ... }
                // export { type C, type D, ... } from 'x'
                // =>
                // export type { A, B }
                // export type { C, D } from 'x'
                const typeOnlyExportDeclaration = copyComments(
                    [n],
                    ts.factory.createExportDeclaration(
                        n.modifiers,
                        true,
                        ts.factory.createNamedExports(
                            typeElements.map((e) =>
                                ts.factory.createExportSpecifier(false, e.propertyName, e.name),
                            ),
                        ),
                        n.moduleSpecifier,
                    ),
                );

                if (valueElements.length === 0) {
                    // export { type A, type B }
                    // export { type C, type D } from 'x'
                    // =>
                    // export type { A, B }
                    // export type { C, D } from 'x'
                    return typeOnlyExportDeclaration;
                } else {
                    // export { A, type B }
                    // export { C, type D } from 'x'
                    // =>
                    // export type { B }
                    // export { A }
                    // export type { C } from 'x'
                    // export { D } from 'x'
                    return [
                        typeOnlyExportDeclaration,
                        ts.factory.createExportDeclaration(
                            n.modifiers,
                            false,
                            ts.factory.createNamedExports(
                                valueElements.map((e) =>
                                    ts.factory.createExportSpecifier(false, e.propertyName, e.name),
                                ),
                            ),
                            n.moduleSpecifier,
                        ),
                    ];
                }
            }
        }

        if (semver.lt(targetVersion, '4.7.0')) {
            if (ts.isTypeParameterDeclaration(n)) {
                return ts.factory.createTypeParameterDeclaration(
                    n.modifiers?.filter(
                        (modifier) =>
                            modifier.kind !== ts.SyntaxKind.InKeyword &&
                            modifier.kind !== ts.SyntaxKind.OutKeyword,
                    ),
                    n.name,
                    n.constraint,
                    n.default,
                );
            }
        }

        return ts.visitEachChild(n, nodeVisitor, k);
    };

    return (sourceFile: SourceFile): SourceFile => {
        const result = nodeVisitor(sourceFile);
        if (!result) return sourceFile;
        else if (Array.isArray(result)) return result[0] as SourceFile;
        else return result as SourceFile;
    };
}

function defaultAny(t: TypeNode | undefined) {
    return t ?? ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
}

function getMatchingAccessor(n: AccessorDeclaration): AccessorDeclaration | undefined {
    const otherKind =
        n.kind === SyntaxKind.SetAccessor ? SyntaxKind.GetAccessor : SyntaxKind.SetAccessor;
    const name = n.name.getText();
    const parent = n.parent;
    let members: NodeArray<ClassElement | TypeElement | ObjectLiteralElementLike>;
    if (
        ts.isClassDeclaration(parent) ||
        ts.isInterfaceDeclaration(parent) ||
        ts.isTypeLiteralNode(parent)
    ) {
        members = parent.members;
    } else if (ts.isObjectLiteralExpression(parent)) {
        members = parent.properties;
    } else {
        return undefined;
    }
    // Search sibling nodes for the matching accessor.
    for (const child of members) {
        if (child.kind === otherKind) {
            const accessor = child as AccessorDeclaration;
            if (accessor.name.getText() === name) return accessor;
        }
    }
    return undefined;
}

function copyComments(originals: Node[], rewrite: Node): Node {
    const file = originals[0].getSourceFile().getFullText();
    const ranges = flatMap(originals, (o) => {
        const comments = ts.getLeadingCommentRanges(file, o.getFullStart());
        return comments ? comments : [];
    });
    if (!ranges.length) return rewrite;

    let kind = ts.SyntaxKind.SingleLineCommentTrivia;
    let hasTrailingNewline = false;
    const commentText = flatMap(ranges, (r) => {
        if (r.kind === ts.SyntaxKind.MultiLineCommentTrivia)
            kind = ts.SyntaxKind.MultiLineCommentTrivia;
        hasTrailingNewline = hasTrailingNewline || !!r.hasTrailingNewLine;
        const comment = file.slice(r.pos, r.end);
        const text = comment.startsWith('//')
            ? comment.slice(2)
            : comment.slice(3, comment.length - 2);
        return text.split('\n').map((line) => line.trimStart());
    }).join('\n');
    return ts.addSyntheticLeadingComment(rewrite, kind, commentText, hasTrailingNewline);
}

function dedupeTripleSlash(s: string): string {
    const lines = s.split('\n');
    const i = lines.findIndex((line) => !line.startsWith('/// <reference '));
    return [...new Set(lines.slice(0, i)), ...lines.slice(i)].join('\n');
}

function mapDefined<T, U>(l: readonly T[], f: (t: T) => U | false | undefined): U[] {
    const acc = [];
    for (const x of l) {
        const y = f(x);
        if (y) acc.push(y);
    }
    return acc;
}

function flatMap<T, U>(l: readonly T[], f: (t: T) => U[]): U[] {
    if (l.flatMap) return l.flatMap(f);
    const acc = [];
    for (const x of l) {
        const ys = f(x);
        acc.push(...ys);
    }
    return acc;
}

/**
 * Checks whether a node is a type reference with typeName as a name
 *
 * @param node AST node
 * @param typeName name of the type
 * @returns true if the node is a type reference with
 *   typeName as a name
 */
function isTypeReference(
    node: Node,
    typeName: string,
): node is TypeReferenceNode | ExpressionWithTypeArguments {
    return (
        (ts.isTypeReferenceNode(node) &&
            ts.isIdentifier(node.typeName) &&
            node.typeName.escapedText === typeName) ||
        (ts.isExpressionWithTypeArguments(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.escapedText === typeName)
    );
}

/**
 * Returns whether a symbol is a standard TypeScript library definition
 *
 * @param symbol a symbol in source file
 * @returns whether this symbol is for a standard TypeScript library definition
 */
function isStdLibSymbol(symbol: ts.Symbol | undefined): boolean {
    return !!(
        symbol &&
        symbol.declarations &&
        symbol.declarations.length &&
        symbol.declarations[0].getSourceFile().fileName.includes('node_modules/typescript/lib/lib')
    );
}

/**
 * Converts accessors to properties. Works for classes, interfaces, type literals, and
 * object literals.
 *
 * @param n
 */
function convertAccessorToProperty(n: AccessorDeclaration): Node | undefined {
    const other = getMatchingAccessor(n);

    if (ts.isSetAccessor(n) && other) {
        // A setter that has a getter will be combined.
        return undefined;
    }

    let flags = ts.getCombinedModifierFlags(n);
    if (ts.isGetAccessor(n) && !other) {
        flags |= ts.ModifierFlags.Readonly;
    }
    const modifiers = ts.factory.createModifiersFromModifierFlags(flags);
    return copyComments(
        other ? [n, other] : [n],
        ts.factory.createPropertyDeclaration(
            modifiers,
            n.name,
            /*?! token*/ undefined,
            // A setter without a getter should use the first parameter as a type
            defaultAny(ts.isSetAccessor(n) ? n.parameters[0].type : n.type),
            /*initialiser*/ undefined,
        ),
    );
}
