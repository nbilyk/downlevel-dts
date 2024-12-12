import semver, { SemVer } from 'semver';
import { isNonNull } from './tsAstUtils';
import ts, {
    type CreateProgramOptions,
    type SourceFile,
    type TransformationContext,
    type TransformerFactory,
    type VisitResult,
} from 'typescript';

/**
 * Contextual properties for the transformers.
 */
export type NodeTransformationContext = {
    readonly targetVersion: SemVer;
    readonly checker: ts.TypeChecker;
    readonly transformationContext: ts.TransformationContext;
};

/**
 * A Node visitor additionally provided the transformation context.
 */
export type DtsVisitor = (
    node: ts.Node,
    context: NodeTransformationContext,
    original: ts.Node,
) => ts.VisitResult<ts.Node | undefined>;

/**
 * Visits a node recursively (depth-first, post-ordered).
 * Invokes a callback for each node, providing the node in the graph and the parent.
 *
 * Note: do not use node.parent; once a node has been transformed the parent reference becomes
 * undefined or invalid, use the provided parent reference.
 */
export function visitDfsPostOrdered(
    node: ts.Node,
    visitor: (node: ts.Node, original: ts.Node) => VisitResult<ts.Node | undefined>,
    context?: ts.TransformationContext | undefined,
): ts.Node | undefined {
    const nodeVisitor = (node: ts.Node): ts.VisitResult<ts.Node | undefined> => {
        const transformed = ts.visitEachChild(node, nodeVisitor, context);
        (transformed as any).parent = node.parent;
        return visitor(transformed, node);
    };
    return ts.visitNode(node, nodeVisitor);
}

/**
 * A map of semver strings to a list of transformers to apply when the target version is less than
 * the key. Use '*' as a key to apply to all nodes.
 */
export type VersionedNodeTransformers = {
    readonly [version: string]: readonly DtsVisitor[];
};

/**
 * Returns a flat list of the transformers to apply for the target version.
 *
 * @param transformerMap
 * @param targetVersion
 */
export function getDtsVisitorsToApply(
    transformerMap: VersionedNodeTransformers,
    targetVersion: SemVer,
): DtsVisitor[] {
    const visitors: DtsVisitor[] = [];
    Object.entries(transformerMap).forEach(([key, value]) => {
        if (key === '*' || semver.lt(targetVersion, key)) {
            visitors.push(...value);
        }
    });
    return visitors;
}

/**
 * Compiles a map of transformers into a single recursive, composite visitor.
 *
 * @param transformerMap
 * @param context
 */
export function createTransformerFromMap(
    transformerMap: VersionedNodeTransformers,
    context: NodeTransformationContext,
): ts.Visitor {
    const visitors = getDtsVisitorsToApply(transformerMap, context.targetVersion);
    if (!visitors.length) return (node) => node;
    // Create ts.Visitor functions for each contextual visitor:

    return (node) => {
        let out = node;
        for (const visitor of visitors) {
            const transformed = visitDfsPostOrdered(
                out,
                (node, original) => {
                    return visitor(node, context, original);
                },
                context.transformationContext,
            );
            if (!transformed) return undefined;
            out = transformed;
        }
        return out;
    };
}

/**
 * Converts a node visitor to a SourceFile Transformer. The returned transformer will throw if the
 * visitor doesn't return a single SourceFile node.
 */
export function createSourceFileTransformer(visitor: ts.Visitor): ts.Transformer<ts.SourceFile> {
    return (sourceFile: ts.SourceFile): ts.SourceFile => {
        const transformed = ts.visitNode(sourceFile, visitor);
        if (!transformed || !ts.isSourceFile(transformed)) {
            throw new Error('transformer changed SourceFile node to another type');
        }
        return transformed;
    };
}

/**
 * Creates a tsc Program and transforms all source files with a provided visitor.
 *
 * @param options
 * @param visitorFactory
 */
export function transformFiles(
    options: CreateProgramOptions,
    visitorFactory: (program: ts.Program, context: TransformationContext) => ts.Visitor,
): ts.SourceFile[] {
    const program = ts.createProgram(options);
    const files = program.getRootFileNames().map(program.getSourceFile).filter(isNonNull);

    const transformerFactory: TransformerFactory<SourceFile> = (context) => {
        return createSourceFileTransformer(visitorFactory(program, context));
    };
    return ts.transform(files, [transformerFactory]).transformed.filter(ts.isSourceFile);
}
