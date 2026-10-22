// ScriptLinter — pemeriksaan kode Bot Script TANPA menjalankannya.
// Memakai acorn untuk parse AST, lalu memeriksa:
//   1. Error sintaks (diterjemahkan ramah oleh FriendlyErrorTranslator).
//   2. Panggilan fungsi yang tidak dikenal / modul bot yang belum terbuka
//      (dibandingkan dengan daftar fungsi yang diizinkan quest + deklarasi
//      buatan pemain sendiri di dalam kode).
// Hasilnya LintError[] berbahasa Indonesia (kontrak blueprint §5).

import { parse } from 'acorn';
import type { LintError } from '../../shared/types';
import {
  blankPlaceholderError,
  syntaxError,
  unknownFunctionError,
} from './FriendlyErrorTranslator';
import { staticPath } from './StepInterpreter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = any;

function lineOf(node: AstNode): number {
  return typeof node?.loc?.start?.line === 'number' ? node.loc.start.line : 1;
}

/** Berjalan menyusuri seluruh AST (mengabaikan metadata lokasi). */
function walk(node: AstNode, visit: (n: AstNode) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
    walk(node[key], visit);
  }
}

/** Kumpulkan semua nama yang dideklarasikan pemain di dalam kode. */
function collectDeclared(program: AstNode): Set<string> {
  const declared = new Set<string>();
  walk(program, (n) => {
    if (n.type === 'FunctionDeclaration' && n.id?.name) declared.add(n.id.name);
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier') declared.add(n.id.name);
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') {
      for (const p of n.params ?? []) {
        if (p?.type === 'Identifier') declared.add(p.name);
        if (p?.type === 'AssignmentPattern' && p.left?.type === 'Identifier') declared.add(p.left.name);
      }
    }
  });
  return declared;
}

export function lintScript(code: string, allowedFunctions: string[]): LintError[] {
  let program: AstNode;
  try {
    program = parse(code, {
      ecmaVersion: 2022,
      locations: true,
      sourceType: 'script',
    }) as AstNode;
  } catch (err) {
    return [syntaxError(err).toLintError()];
  }

  const allowed = new Set(allowedFunctions);
  const declared = collectDeclared(program);
  const errors: LintError[] = [];
  const seen = new Set<string>();

  const pushUnknown = (name: string, line: number) => {
    const key = `${line}|${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    // Blanko template (piko.___ / ___) bukan modul hilang: pesan khusus
    // yang pendek, tanpa daftar modul (audit layout F).
    const lastSegment = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name;
    if (/^_+$/.test(lastSegment)) {
      errors.push(blankPlaceholderError(line).toLintError());
      return;
    }
    errors.push(unknownFunctionError(name, line, allowed).toLintError());
  };

  walk(program, (n) => {
    if (n.type !== 'CallExpression') return;
    const callee: AstNode = n.callee;
    const line = lineOf(n);
    if (callee?.type === 'Identifier') {
      const name = callee.name as string;
      if (!allowed.has(name) && !declared.has(name)) pushUnknown(name, line);
      return;
    }
    if (callee?.type === 'MemberExpression') {
      const path = staticPath(callee);
      if (!path) return;
      const root = path.split('.')[0];
      if (allowed.has(path)) return;
      if (declared.has(root)) return; // metode pada objek lokal pemain
      if (root === 'Math') return; // fungsi hitung bawaan yang aman
      pushUnknown(path, line);
    }
  });

  errors.sort((a, b) => a.line - b.line);
  return errors;
}

/** Namespace sesuai gaya kontrak blueprint §5. */
export const ScriptLinter = {
  lint: lintScript,
};
