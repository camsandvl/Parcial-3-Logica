import { motion } from 'framer-motion';
import type { Formula, Term, TraceNode } from '@contracts/types';

interface Props {
  ast: Formula | null;
  root: TraceNode;
  shown: Set<string>;
  current: string | null;
  overview: boolean;
  onPick: (path: string, node: TraceNode) => void;
}

type SyntaxNode = {
  label: string;
  children: SyntaxNode[];
  path: string;
};

const OPERATOR: Record<'and' | 'or' | 'implies' | 'iff', string> = {
  and: '∧',
  or: '∨',
  implies: '→',
  iff: '↔',
};

function termTree(term: Term, path: string): SyntaxNode {
  if (term.type === 'var') return { label: term.name, children: [], path };
  return {
    label: term.name,
    path,
    children: term.args.map((child, index) => termTree(child, `${path}.${index}`)),
  };
}

function formulaTree(formula: Formula, path = 'r'): SyntaxNode {
  switch (formula.type) {
    case 'pred':
      return {
        label: formula.name,
        path,
        children: formula.args.map((arg, index) => termTree(arg, `${path}.${index}`)),
      };
    case 'not':
      return { label: '¬', path, children: [formulaTree(formula.body, `${path}.0`)] };
    case 'forall':
    case 'exists':
      return {
        label: `${formula.type === 'forall' ? '∀' : '∃'}${formula.var}`,
        path,
        children: [formulaTree(formula.body, `${path}.0`)],
      };
    default:
      return {
        label: OPERATOR[formula.type],
        path,
        children: [
          formulaTree(formula.left, `${path}.0`),
          formulaTree(formula.right, `${path}.1`),
        ],
      };
  }
}

function SyntaxTree({
  node,
  visible,
  depth = 0,
}: {
  node: SyntaxNode;
  visible: (path: string) => boolean;
  depth?: number;
}) {
  if (!visible(node.path)) return null;
  return (
    <motion.li
      className="syntax-tree-node"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: depth * 0.08 }}
    >
      <span className="syntax-tree-label">{node.label}</span>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <SyntaxTree key={child.path} node={child} visible={visible} depth={depth + 1} />
          ))}
        </ul>
      )}
    </motion.li>
  );
}

export function FormulaTree({ ast, root, shown, current, overview, onPick }: Props) {
  const syntax = ast ? formulaTree(ast) : null;
  if (!syntax) return null;

  const visible = (path: string) => overview || path === 'r' || shown.has(path);

  return (
    <div className="formula-tree-syntax" aria-label="Árbol sintáctico de la fórmula">
      <ul>
        <SyntaxTree node={syntax} visible={visible} />
      </ul>
      <button
        type="button"
        className="formula-tree-result"
        onClick={() => onPick('r', root)}
        aria-label="Ver resultado de la fórmula"
      >
        {root.value ? 'V' : 'F'}
      </button>
      {current && overview && <span className="formula-tree-current">Parte seleccionada</span>}
    </div>
  );
}
