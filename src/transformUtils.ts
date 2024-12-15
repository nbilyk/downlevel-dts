import semver, { SemVer } from 'semver';
import { isNonNull } from './tsAstUtils';
import ts, {
    type SourceFile,
    type TransformationContext,
    type TransformerFactory,
    type VisitResult,
} from 'typescript';

/**
 * Contextual properties for the transformers.
 */
export type DownlevelContext = {
    readonly targetVersion: SemVer;
    readonly checker: ts.TypeChecker;
    readonly transformationContext: ts.TransformationContext;
};

/**
 * A Node visitor additionally provided the downlevel context and original node.
 * DownlevelVisitors will be applied to every AST node in the graph, depth-first, post-order.
 */
export type DownlevelVisitor = (
    node: ts.Node,
    original: ts.Node,
    context: DownlevelContext,
) => ts.VisitResult<ts.Node | undefined>;

/**
 * Given a node transformer, creates a `ts.Visitor` that walks the node graph using the transformer.
 *
 * @param transformer
 * @param context
 */
export function createRecursiveVisitorFromTransformer(
    transformer: DownlevelVisitor,
    context: DownlevelContext,
): ts.Transformer<ts.Node> {
    return (node: ts.Node) => {
        const out = postOrderVisitor(
            node,
            (node, original) => {
                return transformer(node, original, context);
            },
            context.transformationContext,
        );
        if (!out) throw new Error('root node expected to be defined');
        return out;
    };
}

/**
 * Merges an array of transformers into one, such that [f, g, h] becomes f(g(h(node)))
 * @param transformers
 */
export function mergeTransformers(
    transformers: ts.Transformer<ts.Node>[],
): ts.Transformer<ts.Node> {
    return (node) => transformers.reduce((out, transformer) => transformer(out), node);
}

/**
 * Visits a node recursively (depth-first, post-ordered).
 * Invokes a callback for each node, providing the node in the graph and the parent.
 *
 * Note: do not use node.parent; once a node has been transformed the parent reference becomes
 * undefined or invalid, use the provided parent reference.
 */
export function postOrderVisitor(
    node: ts.Node,
    visitor: (node: ts.Node, original: ts.Node) => VisitResult<ts.Node | undefined>,
    context?: ts.TransformationContext | undefined,
): ts.Node | undefined {
    const nodeVisitor = (node: ts.Node): ts.VisitResult<ts.Node | undefined> => {
        const transformed = ts.visitEachChild(node, nodeVisitor, context);
        return visitor(transformed, node);
    };
    return ts.visitNode(node, nodeVisitor);
}

/**
 * A map of semver strings to a list of transformers to apply when the target version is less than
 * the key. Use '*' as a key to apply to all nodes.
 */
export type VersionedDownlevelVisitors = {
    readonly [version: string]: readonly DownlevelVisitor[];
};

/**
 * Returns a flat list of downlevel visitors to apply for the target version.
 *
 * @param transformerMap
 * @param targetVersion
 */
export function getVisitorsToApply(
    transformerMap: VersionedDownlevelVisitors,
    targetVersion: SemVer,
): DownlevelVisitor[] {
    const visitors: DownlevelVisitor[] = [];
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
    transformerMap: VersionedDownlevelVisitors,
    context: DownlevelContext,
): ts.Visitor {
    const transformers = getVisitorsToApply(transformerMap, context.targetVersion);
    if (!transformers.length) return (node) => node;
    // Create ts.Visitor functions for each contextual visitor:
    return mergeTransformers(
        transformers.map((transformer) =>
            createRecursiveVisitorFromTransformer(transformer, context),
        ),
    );
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
 * Transforms the files in a program using the visitor produced from the provided visitor factory..
 */
export function transformProgramFiles(
    program: ts.Program,
    visitorFactory: (program: ts.Program, context: TransformationContext) => ts.Visitor,
): ts.SourceFile[] {
    const files = program.getRootFileNames().map(program.getSourceFile).filter(isNonNull);
    const transformerFactory: TransformerFactory<SourceFile> = (context) => {
        return createSourceFileTransformer(visitorFactory(program, context));
    };
    return ts.transform(files, [transformerFactory]).transformed.filter(ts.isSourceFile);
}

/**
 * Down-levels all source files in a program.
 */
export function downlevelProgramFiles(
    program: ts.Program,
    targetVersion: SemVer,
    transformerMap: VersionedDownlevelVisitors,
): ts.SourceFile[] {
    return transformProgramFiles(program, (program, transformationContext) => {
        const checker = program.getTypeChecker();
        return createTransformerFromMap(transformerMap, {
            checker,
            targetVersion,
            transformationContext,
        });
    });
}
