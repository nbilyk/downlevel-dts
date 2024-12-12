import ts from 'typescript';

/**
 * In a named tuple member, remove the name, replacing with a comment.
 *
 * @param n
 */
export function removeTupleMemberName(n: ts.NamedTupleMember): ts.TypeNode {
    return ts.addSyntheticLeadingComment(
        n.dotDotDotToken ? ts.factory.createRestTypeNode(n.type) : n.type,
        ts.SyntaxKind.MultiLineCommentTrivia,
        ts.unescapeLeadingUnderscores(n.name.escapedText),
        /*hasTrailingNewline*/ false,
    );
}

export function createAnyType(): ts.TypeNode {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
}

/**
 * Gets the matching accessor.
 * For example if a get accessor is provided, the sibling set accessor with the matching name will be returned.
 */
export function getMatchingAccessor(
    node: ts.AccessorDeclaration,
    parent: ts.Node | undefined,
): ts.AccessorDeclaration | undefined {
    const otherKind =
        node.kind === ts.SyntaxKind.SetAccessor
            ? ts.SyntaxKind.GetAccessor
            : ts.SyntaxKind.SetAccessor;
    const name = node.name.getText();
    if (!parent) {
        return undefined;
    }
    let members: ts.NodeArray<ts.ClassElement | ts.TypeElement | ts.ObjectLiteralElementLike>;
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
            const accessor = child as ts.AccessorDeclaration;
            if (accessor.name.getText() === name) return accessor;
        }
    }
    return undefined;
}

export function copyComments(originals: ts.Node[], rewrite: ts.Node): ts.Node {
    const file = originals[0].getSourceFile().getFullText();
    const ranges = originals.flatMap((o) => {
        const comments = ts.getLeadingCommentRanges(file, o.getFullStart());
        return comments ? comments : [];
    });
    if (!ranges.length) return rewrite;

    let kind = ts.SyntaxKind.SingleLineCommentTrivia;
    let hasTrailingNewline = false;
    const commentText = ranges
        .flatMap((r) => {
            if (r.kind === ts.SyntaxKind.MultiLineCommentTrivia)
                kind = ts.SyntaxKind.MultiLineCommentTrivia;
            hasTrailingNewline = hasTrailingNewline || !!r.hasTrailingNewLine;
            const comment = file.slice(r.pos, r.end);
            const text = comment.startsWith('//')
                ? comment.slice(2)
                : comment.slice(3, comment.length - 2);
            return text.split('\n').map((line) => line.trimStart());
        })
        .join('\n');
    return ts.addSyntheticLeadingComment(rewrite, kind, commentText, hasTrailingNewline);
}

export function isNonNull<T>(value: T): value is NonNullable<T> {
    return value != null;
}

/**
 * Checks whether a node is a type reference with typeName as a name
 *
 * @param node AST node
 * @param typeName name of the type
 * @returns true if the node is a type reference with
 *   typeName as a name
 */
export function isTypeReference(
    node: ts.Node,
    typeName: string,
): node is ts.TypeReferenceNode | ts.ExpressionWithTypeArguments {
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
export function isStdLibSymbol(symbol: ts.Symbol | undefined): boolean {
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
 */
export function convertAccessorToProperty(
    node: ts.AccessorDeclaration,
    parent: ts.Node | undefined,
): ts.Node | undefined {
    const other = getMatchingAccessor(node, parent);

    if (ts.isSetAccessor(node) && other) {
        // A setter that has a getter will be combined.
        return undefined;
    }

    let flags = ts.getCombinedModifierFlags(node);
    if (ts.isGetAccessor(node) && !other) {
        flags |= ts.ModifierFlags.Readonly;
    }
    const modifiers = ts.factory.createModifiersFromModifierFlags(flags);

    // TS >=4.3 allows separate write types on properties.
    // The best we can do here is make the property a union of the setter and getter types.
    const type = createDistinctUnionType([getAccessorType(node), getAccessorType(other)]);

    return copyComments(
        other ? [node, other] : [node],
        ts.factory.createPropertyDeclaration(
            modifiers,
            node.name,
            /*?! token*/ undefined,
            // A setter without a getter should use the first parameter as a type
            type ?? createAnyType(),
            /*initialiser*/ undefined,
        ),
    );
}

export function convertAccessorType(n: ts.AccessorDeclaration, newType: ts.TypeNode) {
    if (ts.isGetAccessor(n)) {
        // Update the return type of the get accessor
        return ts.factory.createGetAccessorDeclaration(
            n.modifiers,
            n.name,
            n.parameters,
            newType, // New return type
            n.body,
        );
    } else if (ts.isSetAccessor(n)) {
        const updatedParameter = ts.factory.createParameterDeclaration(
            n.parameters[0].modifiers,
            n.parameters[0].dotDotDotToken,
            n.parameters[0].name,
            n.parameters[0].questionToken,
            newType,
            n.parameters[0].initializer,
        );

        // Return new set accessor
        return ts.factory.createSetAccessorDeclaration(
            n.modifiers,
            n.name,
            [updatedParameter],
            n.body,
        );
    }
}

/**
 * Returns the type of accessor. For a getter this is the return type, for a setter this is the
 * first parameter's type.
 *
 * @param n
 */
export function getAccessorType(n: ts.AccessorDeclaration | undefined): ts.TypeNode | undefined {
    if (!n) return undefined;
    return ts.isSetAccessor(n) ? n.parameters[0].type : n.type;
}

/**
 * Creates a union type where identical members are coalesced.
 * @param members
 */
export function createDistinctUnionType(
    members: (ts.TypeNode | undefined)[],
): ts.TypeNode | undefined {
    const uniqueMembers = new Map<string, ts.TypeNode>();

    for (const member of members) {
        if (!member) continue;
        const typeString = member.getText();
        if (!uniqueMembers.has(typeString)) {
            uniqueMembers.set(typeString, member);
        }
    }
    if (uniqueMembers.size === 0) return createAnyType();
    return ts.factory.createUnionTypeNode(Array.from(uniqueMembers.values()));
}

/**
 * Returns true if both types are equal.
 *
 * Note: does not account for type aliases, unions, intersections, and more complex type
 * resolutions.
 */
export function areTypesEqual(
    type1: ts.TypeNode | undefined,
    type2: ts.TypeNode | undefined,
): boolean {
    return type1?.kind === type2?.kind && type1?.getText() === type2?.getText();
}

type NamespaceReexport = ts.ExportDeclaration & {
    readonly exportClause: ts.NamespaceExport;
    readonly moduleSpecifier: ts.Expression;
};

/**
 * Returns true if the node is a namespace re-export, e.g.
 * export * as ns from 'x'
 */
export function isNamespaceReexport(n: ts.Node): n is NamespaceReexport {
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
export function convertNamespaceReexport(n: NamespaceReexport) {
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
