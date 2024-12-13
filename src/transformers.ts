import type { DownlevelVisitor, VersionedNodeTransformers } from './transformUtils';
import ts from 'typescript';
import semver from 'semver';
import {
    areTypesEqual,
    convertAccessorToProperty,
    convertAccessorType,
    convertNamespaceReexport,
    copyComments,
    createAnyType,
    createDistinctUnionType,
    getAccessorType,
    getMatchingAccessor,
    isNamespaceReexport,
    isStdLibSymbol,
    isTypeReference,
    removeTupleMemberName,
} from './tsAstUtils';

const omitHelperType: DownlevelVisitor = (node, _original, context) => {
    if (isTypeReference(node, 'Omit')) {
        const symbol = context.checker.getSymbolAtLocation(
            ts.isTypeReferenceNode(node) ? node.typeName : node.expression,
        );
        const typeArguments = node.typeArguments;

        if (isStdLibSymbol(symbol) && typeArguments) {
            return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Pick'), [
                typeArguments[0],
                ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Exclude'), [
                    ts.factory.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword, typeArguments[0]),
                    typeArguments[1],
                ]),
            ]);
        }
    }
    return node;
};

const accessors: DownlevelVisitor = (node, original) => {
    if (ts.isAccessor(node)) return convertAccessorToProperty(node, original.parent);
    return node;
};

const iteratorResult: DownlevelVisitor = (node, _original, context) => {
    if (isTypeReference(node, 'IteratorResult')) {
        const symbol = context.checker.getSymbolAtLocation(
            ts.isTypeReferenceNode(node) ? node.typeName : node.expression,
        );
        const typeArguments = node.typeArguments;
        if (isStdLibSymbol(symbol) && typeArguments) {
            return ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier('IteratorResult'),
                [typeArguments[0]],
            );
        }
    }
    return node;
};

const functionTypeAsserts: DownlevelVisitor = (node) => {
    if (
        ts.isFunctionTypeNode(node) &&
        node.type &&
        ts.isTypePredicateNode(node.type) &&
        node.type.assertsModifier
    ) {
        return ts.factory.createFunctionTypeNode(
            node.typeParameters,
            node.parameters,
            ts.factory.createTypeReferenceNode('void', undefined),
        );
    }
    return node;
};

const functionDeclarationAsserts: DownlevelVisitor = (node) => {
    if (
        ts.isFunctionDeclaration(node) &&
        node.type &&
        ts.isTypePredicateNode(node.type) &&
        node.type.assertsModifier
    ) {
        return ts.factory.createFunctionDeclaration(
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.typeParameters,
            node.parameters,
            ts.factory.createTypeReferenceNode('void', undefined),
            node.body,
        );
    }
    return node;
};

const privateIdentifier: DownlevelVisitor = (node) => {
    if (
        ts.isPropertyDeclaration(node) &&
        ts.isPrivateIdentifier(node.name) &&
        node.name.escapedText === '#private'
    ) {
        // #private => private "#private"
        const modifiers = ts.factory.createModifiersFromModifierFlags(ts.ModifierFlags.Private);
        const parentName = node.parent.name ? node.parent.name.escapedText : '(anonymous)';
        return ts.factory.createPropertyDeclaration(
            modifiers,
            ts.factory.createStringLiteral(parentName + '.#private'),
            /*?! token*/ undefined,
            /*type*/ undefined,
            /*initialiser*/ undefined,
        );
    }
    return node;
};

const namespaceReexport: DownlevelVisitor = (node) => {
    if (isNamespaceReexport(node)) return convertNamespaceReexport(node);
    return node;
};

/**
 * export type T;
 *
 * becomes
 *
 * export T;
 *
 * @param node
 */
const typeExports: DownlevelVisitor = (node) => {
    if (ts.isExportDeclaration(node) && node.isTypeOnly) {
        return ts.factory.createExportDeclaration(
            node.modifiers,
            /* isTypeOnly */ false,
            node.exportClause,
            node.moduleSpecifier,
        );
    }
    return node;
};

/**
 * import type { T } from 'x';
 *
 * becomes
 *
 * import { T } from 'x';
 *
 * @param node
 */
const typeImports: DownlevelVisitor = (node) => {
    if (ts.isImportClause(node) && node.isTypeOnly) {
        return ts.factory.createImportClause(/* isTypeOnly */ false, node.name, node.namedBindings);
    }
    return node;
};

const variadicTuples: DownlevelVisitor = (node) => {
    // variadic tuple types not supported in earlier versions. Use Array<any>
    // spread is allowed if at the last position and an array type.
    if (
        ts.isTupleTypeNode(node) &&
        node.elements.find((element, index) => {
            return (
                ts.isRestTypeNode(element) ||
                (ts.isNamedTupleMember(element) && element.dotDotDotToken)
            );
        })
    ) {
        return ts.factory.createArrayTypeNode(createAnyType());
    }

    // Previous to 4.0 tuple members must not have names.
    if (ts.isNamedTupleMember(node)) {
        return removeTupleMemberName(node);
    }
    return node;
};

const templateLiterals: DownlevelVisitor = (node) => {
    if (
        node.kind === ts.SyntaxKind.TemplateLiteralType ||
        isTypeReference(node, 'Uppercase') ||
        isTypeReference(node, 'Lowercase') ||
        isTypeReference(node, 'Capitalize') ||
        isTypeReference(node, 'Uncapitalize')
    ) {
        // TemplateLiteralType added in 4.1
        // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html#template-literal-types
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    }
    if (isNamespaceReexport(node) && node.exportClause.name.getText() === 'default') {
        return convertNamespaceReexport(node);
    }
    return node;
};

const interfaceAccessors: DownlevelVisitor = (node, original) => {
    if (ts.isAccessor(node)) {
        // Accessors became supported in interfaces, object literals, and type literals in 4.3
        const parent = original.parent;
        if (
            parent &&
            (ts.isInterfaceDeclaration(parent) ||
                ts.isObjectLiteralElement(parent) ||
                ts.isTypeLiteralNode(parent))
        ) {
            return convertAccessorToProperty(node, parent);
        }

        // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-3.html#separate-write-types-on-properties
        // 4.3 allows separate write types for getters/setters.
        const other = getMatchingAccessor(node, original.parent);
        const typeA = getAccessorType(node);
        const typeB = getAccessorType(other);
        if (!areTypesEqual(typeA, typeB)) {
            const newType = createDistinctUnionType([typeA, typeB]);
            return convertAccessorType(node, newType ?? createAnyType());
        }
    }
    return node;
};

const mixedTypeImports: DownlevelVisitor = (node, _original, context) => {
    const { targetVersion } = context;
    if (
        ts.isImportDeclaration(node) &&
        !node.modifiers &&
        node.importClause &&
        !node.importClause.isTypeOnly &&
        node.importClause.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.some((e) => e.isTypeOnly)
    ) {
        const elements = node.importClause.namedBindings.elements;

        if (semver.lt(targetVersion, '3.8.0')) {
            // import { A, type B } from 'x'
            // =>
            // import { A, B } from 'x'
            return copyComments(
                [node],
                ts.factory.createImportDeclaration(
                    node.modifiers,
                    ts.factory.createImportClause(
                        false,
                        node.importClause.name,
                        ts.factory.createNamedImports(
                            elements.map((e) =>
                                ts.factory.createImportSpecifier(false, e.propertyName, e.name),
                            ),
                        ),
                    ),
                    node.moduleSpecifier,
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
            [node],
            ts.factory.createImportDeclaration(
                node.modifiers,
                ts.factory.createImportClause(
                    true,
                    node.importClause.name,
                    ts.factory.createNamedImports(
                        typeElements.map((e) =>
                            ts.factory.createImportSpecifier(false, e.propertyName, e.name),
                        ),
                    ),
                ),
                node.moduleSpecifier,
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
                    node.modifiers,
                    ts.factory.createImportClause(
                        false,
                        node.importClause.name,
                        ts.factory.createNamedImports(
                            valueElements.map((e) =>
                                ts.factory.createImportSpecifier(false, e.propertyName, e.name),
                            ),
                        ),
                    ),
                    node.moduleSpecifier,
                ),
            ];
        }
    }

    if (
        ts.isExportDeclaration(node) &&
        !node.modifiers &&
        !node.isTypeOnly &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.some((e) => e.isTypeOnly)
    ) {
        const elements = node.exportClause.elements;

        if (semver.lt(targetVersion, '3.8.0')) {
            // export { A, type B }
            // export { C, type D } from 'x'
            // =>
            // export { A, B }
            // export { C, D } from 'x'
            return copyComments(
                [node],
                ts.factory.createExportDeclaration(
                    node.modifiers,
                    false,
                    ts.factory.createNamedExports(
                        elements.map((e) =>
                            ts.factory.createExportSpecifier(false, e.propertyName, e.name),
                        ),
                    ),
                    node.moduleSpecifier,
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
            [node],
            ts.factory.createExportDeclaration(
                node.modifiers,
                true,
                ts.factory.createNamedExports(
                    typeElements.map((e) =>
                        ts.factory.createExportSpecifier(false, e.propertyName, e.name),
                    ),
                ),
                node.moduleSpecifier,
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
                    node.modifiers,
                    false,
                    ts.factory.createNamedExports(
                        valueElements.map((e) =>
                            ts.factory.createExportSpecifier(false, e.propertyName, e.name),
                        ),
                    ),
                    node.moduleSpecifier,
                ),
            ];
        }
    }
    return node;
};

const typeParameterDeclaration: DownlevelVisitor = (node) => {
    if (ts.isTypeParameterDeclaration(node)) {
        return ts.factory.createTypeParameterDeclaration(
            node.modifiers?.filter(
                (modifier) =>
                    modifier.kind !== ts.SyntaxKind.InKeyword &&
                    modifier.kind !== ts.SyntaxKind.OutKeyword,
            ),
            node.name,
            node.constraint,
            node.default,
        );
    }
    return node;
};

const unrelatedSetAccessor: DownlevelVisitor = (node, original, context) => {
    const { checker } = context;
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-1.html#unrelated-types-for-getters-and-setters
    // 5.1 allows unrelated getters/setters, prior to this the return type of the 'get' accessor must be
    // assignable to its 'set' accessor type
    if (ts.isSetAccessor(node)) {
        const getter = getMatchingAccessor(node, original.parent);
        if (getter) {
            const setTypeNode = getAccessorType(node);
            const setType = checker.getTypeFromTypeNode(setTypeNode ?? createAnyType());
            const getTypeNode = getter.type;
            const getType = checker.getTypeFromTypeNode(getTypeNode ?? createAnyType());
            if (!checker.isTypeAssignableTo(getType, setType)) {
                const newType = createDistinctUnionType([getTypeNode, setTypeNode]);
                return convertAccessorType(node, newType ?? createAnyType());
            }
        }
    }
    return node;
};

const tupleMixedNames: DownlevelVisitor = (node, original) => {
    // All tuple members must be named, or none. Check if parent tuple has
    // mixed members and replace with commented, unnamed member.
    if (
        ts.isNamedTupleMember(node) &&
        original.parent &&
        ts.isTupleTypeNode(original.parent) &&
        original.parent.elements.find((element) => !ts.isNamedTupleMember(element))
    ) {
        return removeTupleMemberName(node);
    }
    return node;
};

/**
 * A map of versions to transformers where the version is the maximum version for which the
 * transformer should be applied.
 */
export const transformerMap: VersionedNodeTransformers = {
    '3.5.0': [omitHelperType],
    '3.6.0': [accessors, iteratorResult],
    '3.7.0': [functionTypeAsserts, functionDeclarationAsserts],
    '3.8.0': [privateIdentifier, namespaceReexport, typeExports, typeImports],
    '4.0.0': [variadicTuples],
    '4.1.0': [templateLiterals],
    '4.3.0': [interfaceAccessors],
    '4.5.0': [mixedTypeImports],
    '4.7.0': [typeParameterDeclaration],
    '5.1.0': [unrelatedSetAccessor],
    '5.2.0': [tupleMixedNames],
    '*': [],
};
