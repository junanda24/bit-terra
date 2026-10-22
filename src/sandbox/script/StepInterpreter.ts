// StepInterpreter — mengeksekusi kode pemain (Bot Script) baris demi baris.
//
// Acorn mem-parse kode menjadi AST, lalu AST diinterpretasikan MANUAL oleh
// kode ini (generator async). DILARANG KERAS memakai eval / new Function
// (docs/BLUEPRINT.md §3 aturan 3). Setiap panggilan fungsi bot menghasilkan
// StepEvent SEBELUM fungsi benar-benar dijalankan, supaya UI bisa me-highlight
// baris aktif dan menganimasikan dunia lebih dulu (blueprint §3.C).
//
// LoopGuard: total iterasi semua loop dalam satu Run dibatasi 500 — loop tak
// berujung berubah menjadi FriendlyError ramah, bukan tab yang membeku.

import { parse } from 'acorn';
import type { StepEvent } from '../../shared/types';
import type { BotApiRegistry } from './BotApiBindings';
import {
  FriendlyError,
  loopGuardError,
  syntaxError,
  translateError,
  typeError,
  undefinedVariableError,
  unknownFunctionError,
} from './FriendlyErrorTranslator';

/** Batas total iterasi loop per Run (blueprint §3: LoopGuard 500 ticks). */
export const MAX_LOOP_ITERATIONS = 500;
/** Batas kedalaman panggilan fungsi buatan pemain (anti rekursi tak berujung). */
export const MAX_CALL_DEPTH = 100;

// Acorn nodes are loosely typed; we walk them structurally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = any;

function lineOf(node: AstNode): number {
  return typeof node?.loc?.start?.line === 'number' ? node.loc.start.line : 1;
}

/** Nama bertitik statis dari rantai MemberExpression, mis. "piko.moveForward". */
export function staticPath(node: AstNode): string | null {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name as string;
  if (node.type === 'MemberExpression' && !node.computed && node.property?.type === 'Identifier') {
    const base = staticPath(node.object);
    return base ? `${base}.${node.property.name}` : null;
  }
  return null;
}

/* ---------------------------------- scope --------------------------------- */

class Scope {
  readonly vars = new Map<string, unknown>();
  readonly parent: Scope | null;
  constructor(parent: Scope | null) {
    this.parent = parent;
  }

  declare(name: string, value: unknown): void {
    this.vars.set(name, value);
  }

  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }

  lookup(name: string, line: number): unknown {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.lookup(name, line);
    throw undefinedVariableError(name, line);
  }

  assign(name: string, value: unknown, line: number): void {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value, line);
      return;
    }
    throw undefinedVariableError(name, line);
  }
}

/* --------------------------------- signals -------------------------------- */

class ReturnSignal {
  readonly value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}
class BreakSignal {}
class ContinueSignal {}

/* ------------------------------- user function ----------------------------- */

interface FnParam {
  name: string;
  defaultNode?: AstNode;
}

class UserFunction {
  readonly name: string;
  readonly params: FnParam[];
  readonly body: AstNode[];
  readonly closure: Scope;
  constructor(name: string, params: FnParam[], body: AstNode[], closure: Scope) {
    this.name = name;
    this.params = params;
    this.body = body;
    this.closure = closure;
  }
}

function makeUserFunction(node: AstNode, closure: Scope, fallbackName: string): UserFunction {
  const params: FnParam[] = (node.params ?? []).map((p: AstNode) => {
    if (p.type === 'Identifier') return { name: p.name as string };
    if (p.type === 'AssignmentPattern' && p.left?.type === 'Identifier') {
      return { name: p.left.name as string, defaultNode: p.right };
    }
    return { name: '_' };
  });
  const body: AstNode[] = node.body?.type === 'BlockStatement' ? node.body.body : [];
  return new UserFunction(node.id?.name ?? fallbackName, params, body, closure);
}

/* --------------------------------- context -------------------------------- */

interface RunContext {
  registry: BotApiRegistry;
  loopIterations: number;
  callDepth: number;
}

function bumpLoopGuard(ctx: RunContext, line: number): void {
  ctx.loopIterations += 1;
  if (ctx.loopIterations > MAX_LOOP_ITERATIONS) throw loopGuardError(line);
}

/* ------------------------------ member access ----------------------------- */

interface MemberRef {
  get: () => unknown;
  set: (value: unknown) => void;
}

async function* memberRef(
  node: AstNode,
  scope: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, MemberRef, undefined> {
  const path = staticPath(node);
  if (path) {
    const parts = path.split('.');
    const root = parts[0];
    if (root in ctx.registry.objects) {
      const key = parts[parts.length - 1];
      let parent: Record<string, unknown> = ctx.registry.objects[root];
      for (const part of parts.slice(1, -1)) {
        const next = parent[part];
        if (next === null || typeof next !== 'object') {
          throw typeError(
            `Piko tidak bisa membaca '${path}' — jalurnya terputus di tengah.`,
            lineOf(node),
          );
        }
        parent = next as Record<string, unknown>;
      }
      return {
        get: () => parent[key],
        set: (v: unknown) => {
          parent[key] = v;
        },
      };
    }
  }
  const obj = yield* evalExpr(node.object, scope, ctx);
  const keyRaw = node.computed ? yield* evalExpr(node.property, scope, ctx) : node.property?.name;
  const key = String(keyRaw);
  if (obj === null || obj === undefined || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw typeError(
      `Di baris ${lineOf(node)}, Piko mencoba membaca isi dari nilai yang kosong.`,
      lineOf(node),
      'Pastikan variabelnya sudah diisi nilai sebelum isinya dibaca ya.',
    );
  }
  const target = obj as Record<string, unknown>;
  return {
    get: () => target[key],
    set: (v: unknown) => {
      target[key] = v;
    },
  };
}

/* ------------------------------- expressions ------------------------------ */

async function* evalExpr(
  node: AstNode,
  scope: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, unknown, undefined> {
  const line = lineOf(node);
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier': {
      const name = node.name as string;
      if (name === 'undefined') return undefined;
      if (scope.has(name)) return scope.lookup(name, line);
      if (name in ctx.registry.objects) return ctx.registry.objects[name];
      if (name === 'Math') return Math;
      throw undefinedVariableError(name, line);
    }

    case 'MemberExpression': {
      const path = staticPath(node);
      if (path && path in ctx.registry.api) {
        const fn = ctx.registry.api[path];
        return (...args: unknown[]) => fn(...args);
      }
      const ref = yield* memberRef(node, scope, ctx);
      return ref.get();
    }

    case 'CallExpression':
      return yield* evalCall(node, scope, ctx);

    case 'BinaryExpression': {
      const l = yield* evalExpr(node.left, scope, ctx);
      const r = yield* evalExpr(node.right, scope, ctx);
      return applyBinary(node.operator as string, l, r, line);
    }

    case 'LogicalExpression': {
      const l = yield* evalExpr(node.left, scope, ctx);
      if (node.operator === '&&') return l ? yield* evalExpr(node.right, scope, ctx) : l;
      if (node.operator === '||') return l ? l : yield* evalExpr(node.right, scope, ctx);
      // '??'
      return l === null || l === undefined ? yield* evalExpr(node.right, scope, ctx) : l;
    }

    case 'UnaryExpression': {
      if (node.operator === 'typeof') {
        if (node.argument?.type === 'Identifier' && !scope.has(node.argument.name)) return 'undefined';
        const v = yield* evalExpr(node.argument, scope, ctx);
        return typeof v;
      }
      const v = yield* evalExpr(node.argument, scope, ctx);
      switch (node.operator) {
        case '-':
          return -(v as number);
        case '+':
          return +(v as number);
        case '!':
          return !v;
        case '~':
          return ~(v as number);
        case 'void':
          return undefined;
        default:
          throw typeError(`Piko belum mengerti tanda '${node.operator}' di baris ${line}.`, line);
      }
    }

    case 'UpdateExpression': {
      const cur = yield* readTarget(node.argument, scope, ctx);
      if (typeof cur !== 'number') {
        throw typeError(
          `Tanda ${node.operator} di baris ${line} hanya bisa dipakai pada angka.`,
          line,
        );
      }
      const next = node.operator === '++' ? cur + 1 : cur - 1;
      yield* writeTarget(node.argument, next, scope, ctx);
      return node.prefix ? next : cur;
    }

    case 'AssignmentExpression': {
      let value: unknown;
      if (node.operator === '=') {
        value = yield* evalExpr(node.right, scope, ctx);
      } else {
        const cur = yield* readTarget(node.left, scope, ctx);
        const r = yield* evalExpr(node.right, scope, ctx);
        value = applyBinary((node.operator as string).slice(0, -1), cur, r, line);
      }
      yield* writeTarget(node.left, value, scope, ctx);
      yield { line, kind: 'assign' };
      return value;
    }

    case 'ConditionalExpression': {
      const test = yield* evalExpr(node.test, scope, ctx);
      return test
        ? yield* evalExpr(node.consequent, scope, ctx)
        : yield* evalExpr(node.alternate, scope, ctx);
    }

    case 'TemplateLiteral': {
      let out = '';
      for (let i = 0; i < node.quasis.length; i++) {
        out += node.quasis[i].value.cooked ?? '';
        if (i < node.expressions.length) {
          const v = yield* evalExpr(node.expressions[i], scope, ctx);
          out += String(v);
        }
      }
      return out;
    }

    case 'ArrayExpression': {
      const arr: unknown[] = [];
      for (const el of node.elements) {
        arr.push(el ? yield* evalExpr(el, scope, ctx) : undefined);
      }
      return arr;
    }

    case 'ObjectExpression': {
      const obj: Record<string, unknown> = {};
      for (const prop of node.properties) {
        if (prop.type !== 'Property') continue;
        const key = prop.computed
          ? String(yield* evalExpr(prop.key, scope, ctx))
          : String(prop.key.name ?? prop.key.value);
        obj[key] = yield* evalExpr(prop.value, scope, ctx);
      }
      return obj;
    }

    case 'SequenceExpression': {
      let last: unknown;
      for (const e of node.expressions) last = yield* evalExpr(e, scope, ctx);
      return last;
    }

    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return makeUserFunction(node, scope, 'fungsi');

    case 'AwaitExpression':
      return yield* evalExpr(node.argument, scope, ctx);

    default:
      throw typeError(
        `Piko belum mengerti perintah di baris ${line}.`,
        line,
        'Coba sederhanakan baris itu: satu perintah dalam satu baris biasanya paling mudah dibaca Piko.',
      );
  }
}

function applyBinary(op: string, l: unknown, r: unknown, line: number): unknown {
  switch (op) {
    case '+':
      return (l as never) + (r as never);
    case '-':
      return (l as number) - (r as number);
    case '*':
      return (l as number) * (r as number);
    case '/':
      return (l as number) / (r as number);
    case '%':
      return (l as number) % (r as number);
    case '**':
      return (l as number) ** (r as number);
    case '===':
      return l === r;
    case '!==':
      return l !== r;
    case '==':
      // Kesetaraan longgar memang disengaja di sini (semantik JS untuk pemain).
      return (l as never) == (r as never);
    case '!=':
      return (l as never) != (r as never);
    case '<':
      return (l as never) < (r as never);
    case '<=':
      return (l as never) <= (r as never);
    case '>':
      return (l as never) > (r as never);
    case '>=':
      return (l as never) >= (r as never);
    case '&':
      return (l as number) & (r as number);
    case '|':
      return (l as number) | (r as number);
    case '^':
      return (l as number) ^ (r as number);
    case '<<':
      return (l as number) << (r as number);
    case '>>':
      return (l as number) >> (r as number);
    case '>>>':
      return (l as number) >>> (r as number);
    case 'in':
      return r !== null && typeof r === 'object' ? String(l) in (r as object) : false;
    case 'instanceof':
      return false;
    default:
      throw typeError(`Piko belum mengerti tanda hitung '${op}' di baris ${line}.`, line);
  }
}

/* ------------------------------ l-value access ---------------------------- */

async function* readTarget(
  node: AstNode,
  scope: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, unknown, undefined> {
  if (node.type === 'Identifier') {
    const name = node.name as string;
    if (scope.has(name)) return scope.lookup(name, lineOf(node));
    throw undefinedVariableError(name, lineOf(node));
  }
  if (node.type === 'MemberExpression') {
    const ref = yield* memberRef(node, scope, ctx);
    return ref.get();
  }
  throw typeError(`Bagian kiri tanda = di baris ${lineOf(node)} harus nama variabel.`, lineOf(node));
}

async function* writeTarget(
  node: AstNode,
  value: unknown,
  scope: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, void, undefined> {
  if (node.type === 'Identifier') {
    scope.assign(node.name as string, value, lineOf(node));
    return;
  }
  if (node.type === 'MemberExpression') {
    const ref = yield* memberRef(node, scope, ctx);
    ref.set(value);
    return;
  }
  throw typeError(`Bagian kiri tanda = di baris ${lineOf(node)} harus nama variabel.`, lineOf(node));
}

/* ---------------------------------- calls --------------------------------- */

async function* evalCall(
  node: AstNode,
  scope: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, unknown, undefined> {
  const line = lineOf(node);
  const callee: AstNode = node.callee;

  const evalArgs = async function* (): AsyncGenerator<StepEvent, unknown[], undefined> {
    const args: unknown[] = [];
    for (const a of node.arguments) {
      if (a.type === 'SpreadElement') {
        const v = yield* evalExpr(a.argument, scope, ctx);
        if (Array.isArray(v)) args.push(...v);
        else throw typeError(`Tanda ... di baris ${line} hanya bisa menyebar daftar nilai.`, line);
      } else {
        args.push(yield* evalExpr(a, scope, ctx));
      }
    }
    return args;
  };

  // 1) Panggilan bertitik: piko.moveForward(3), gate.open(), ...
  const path = staticPath(callee);
  if (path && path in ctx.registry.api) {
    if (!ctx.registry.allowed.has(path)) {
      throw unknownFunctionError(path, line, ctx.registry.allowed);
    }
    const args = yield* evalArgs();
    // StepEvent dikirim SEBELUM fungsi bot dijalankan (highlight + animasi dulu).
    yield { line, kind: 'call', action: path, args };
    return ctx.registry.api[path](...args);
  }

  // 2) Math.* — aman, murni hitungan.
  if (path && path.startsWith('Math.')) {
    const fnName = path.slice('Math.'.length);
    const fn = (Math as unknown as Record<string, unknown>)[fnName];
    if (typeof fn === 'function') {
      const args = yield* evalArgs();
      return (fn as (...a: unknown[]) => unknown)(...args);
    }
    throw unknownFunctionError(path, line, ctx.registry.allowed);
  }

  // 3) Fungsi buatan pemain (Identifier atau hasil ekspresi).
  if (callee.type === 'Identifier') {
    const name = callee.name as string;
    if (scope.has(name)) {
      const val = scope.lookup(name, line);
      if (val instanceof UserFunction) {
        const args = yield* evalArgs();
        return yield* callUserFunction(val, args, ctx, line);
      }
      throw typeError(
        `'${name}' di baris ${line} bukan fungsi, jadi tidak bisa dipanggil dengan ().`,
        line,
      );
    }
    // Nama polos yang mungkin fungsi bot tanpa awalan objek.
    if (name in ctx.registry.api) {
      if (!ctx.registry.allowed.has(name)) throw unknownFunctionError(name, line, ctx.registry.allowed);
      const args = yield* evalArgs();
      yield { line, kind: 'call', action: name, args };
      return ctx.registry.api[name](...args);
    }
    throw unknownFunctionError(name, line, ctx.registry.allowed);
  }

  if (path) throw unknownFunctionError(path, line, ctx.registry.allowed);

  // 4) Callee ekspresi umum (metode pada nilai lokal, fungsi hasil ekspresi).
  const fnVal = yield* evalExpr(callee, scope, ctx);
  if (fnVal instanceof UserFunction) {
    const args = yield* evalArgs();
    return yield* callUserFunction(fnVal, args, ctx, line);
  }
  if (typeof fnVal === 'function') {
    const args = yield* evalArgs();
    return (fnVal as (...a: unknown[]) => unknown)(...args);
  }
  throw typeError(
    `Yang dipanggil di baris ${line} bukan fungsi.`,
    line,
    'Hanya fungsi bot (misalnya piko.moveForward) dan fungsi buatanmu sendiri yang bisa dipanggil.',
  );
}

async function* callUserFunction(
  fn: UserFunction,
  args: unknown[],
  ctx: RunContext,
  line: number,
): AsyncGenerator<StepEvent, unknown, undefined> {
  if (ctx.callDepth >= MAX_CALL_DEPTH) {
    throw typeError(
      `Fungsi '${fn.name}' memanggil dirinya terlalu dalam — Piko sampai pusing.`,
      line,
      'Kalau fungsimu memanggil dirinya sendiri, pastikan ada kondisi berhenti ya.',
    );
  }
  ctx.callDepth += 1;
  try {
    const scope = new Scope(fn.closure);
    for (let i = 0; i < fn.params.length; i++) {
      const p = fn.params[i];
      let value = args[i];
      if (value === undefined && p.defaultNode) {
        value = yield* evalExpr(p.defaultNode, scope, ctx);
      }
      scope.declare(p.name, value);
    }
    try {
      yield* execStatements(fn.body, scope, ctx);
    } catch (err) {
      if (err instanceof ReturnSignal) return err.value;
      throw err;
    }
    return undefined;
  } finally {
    ctx.callDepth -= 1;
  }
}

/* -------------------------------- statements ------------------------------ */

async function* execStatements(
  stmts: AstNode[],
  scope: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, void, undefined> {
  // Hoisting deklarasi fungsi ke scope saat ini.
  for (const s of stmts) {
    if (s?.type === 'FunctionDeclaration' && s.id) {
      scope.declare(s.id.name as string, makeUserFunction(s, scope, s.id.name as string));
    }
  }
  for (const s of stmts) {
    if (!s) continue;
    yield* execStmt(s, scope, ctx);
  }
}

async function* execBlockNode(
  node: AstNode,
  parent: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, void, undefined> {
  yield* execStatements(node.body as AstNode[], new Scope(parent), ctx);
}

async function* execStmt(
  node: AstNode,
  scope: Scope,
  ctx: RunContext,
): AsyncGenerator<StepEvent, void, undefined> {
  const line = lineOf(node);
  switch (node.type) {
    case 'EmptyStatement':
      return;

    case 'BlockStatement':
      yield* execBlockNode(node, scope, ctx);
      return;

    case 'ExpressionStatement':
      yield* evalExpr(node.expression, scope, ctx);
      return;

    case 'VariableDeclaration': {
      for (const decl of node.declarations) {
        if (decl.id?.type !== 'Identifier') {
          throw typeError(
            `Piko belum bisa membongkar pola variabel di baris ${line}.`,
            line,
            'Tulis satu nama variabel dulu ya, misalnya: let langkah = 3;',
          );
        }
        const name = decl.id.name as string;
        const value = decl.init ? yield* evalExpr(decl.init, scope, ctx) : undefined;
        scope.declare(name, value);
        yield { line, kind: 'assign' };
      }
      return;
    }

    case 'IfStatement': {
      const test = yield* evalExpr(node.test, scope, ctx);
      yield { line, kind: 'branch' };
      if (test) {
        yield* execStmt(node.consequent, scope, ctx);
      } else if (node.alternate) {
        yield* execStmt(node.alternate, scope, ctx);
      }
      return;
    }

    case 'ForStatement': {
      const loopScope = new Scope(scope);
      if (node.init) {
        if (node.init.type === 'VariableDeclaration') yield* execStmt(node.init, loopScope, ctx);
        else yield* evalExpr(node.init, loopScope, ctx);
      }
      for (;;) {
        if (node.test) {
          const t = yield* evalExpr(node.test, loopScope, ctx);
          if (!t) break;
        }
        bumpLoopGuard(ctx, line);
        yield { line, kind: 'loop' };
        try {
          yield* execStmt(node.body, loopScope, ctx);
        } catch (err) {
          if (err instanceof BreakSignal) break;
          if (!(err instanceof ContinueSignal)) throw err;
        }
        if (node.update) yield* evalExpr(node.update, loopScope, ctx);
      }
      return;
    }

    case 'ForOfStatement':
    case 'ForInStatement': {
      const right = yield* evalExpr(node.right, scope, ctx);
      let items: unknown[];
      if (node.type === 'ForOfStatement') {
        if (Array.isArray(right)) items = right;
        else if (typeof right === 'string') items = [...right];
        else {
          throw typeError(
            `Nilai di baris ${line} tidak bisa diulang satu-satu — bukan daftar.`,
            line,
            'for...of hanya bisa mengulang daftar, misalnya daftar angka [1, 2, 3].',
          );
        }
      } else {
        if (right !== null && typeof right === 'object') items = Object.keys(right as object);
        else items = [];
      }
      const loopScope = new Scope(scope);
      const declarator = node.left?.type === 'VariableDeclaration' ? node.left.declarations[0] : null;
      for (const item of items) {
        bumpLoopGuard(ctx, line);
        yield { line, kind: 'loop' };
        const iterScope = new Scope(loopScope);
        if (declarator?.id?.type === 'Identifier') {
          iterScope.declare(declarator.id.name as string, item);
        } else if (node.left?.type) {
          yield* writeTarget(node.left, item, iterScope, ctx);
        }
        try {
          yield* execStmt(node.body, iterScope, ctx);
        } catch (err) {
          if (err instanceof BreakSignal) break;
          if (!(err instanceof ContinueSignal)) throw err;
        }
      }
      return;
    }

    case 'WhileStatement': {
      for (;;) {
        const t = yield* evalExpr(node.test, scope, ctx);
        if (!t) break;
        bumpLoopGuard(ctx, line);
        yield { line, kind: 'loop' };
        try {
          yield* execStmt(node.body, scope, ctx);
        } catch (err) {
          if (err instanceof BreakSignal) break;
          if (!(err instanceof ContinueSignal)) throw err;
        }
      }
      return;
    }

    case 'DoWhileStatement': {
      for (;;) {
        bumpLoopGuard(ctx, line);
        yield { line, kind: 'loop' };
        try {
          yield* execStmt(node.body, scope, ctx);
        } catch (err) {
          if (err instanceof BreakSignal) break;
          if (!(err instanceof ContinueSignal)) throw err;
        }
        const t = yield* evalExpr(node.test, scope, ctx);
        if (!t) break;
      }
      return;
    }

    case 'FunctionDeclaration':
      // Sudah di-hoist oleh execStatements; jaga-jaga untuk posisi bersarang.
      if (node.id && !scope.has(node.id.name as string)) {
        scope.declare(node.id.name as string, makeUserFunction(node, scope, node.id.name as string));
      }
      return;

    case 'ReturnStatement': {
      const value = node.argument ? yield* evalExpr(node.argument, scope, ctx) : undefined;
      throw new ReturnSignal(value);
    }

    case 'BreakStatement':
      throw new BreakSignal();

    case 'ContinueStatement':
      throw new ContinueSignal();

    default:
      throw typeError(
        `Piko belum mengerti perintah di baris ${line}.`,
        line,
        'Perintah yang Piko kenal: panggilan fungsi bot, let, if, for, while, dan function.',
      );
  }
}

/* ---------------------------------- entry --------------------------------- */

/**
 * Jalankan kode Bot Script pemain. Menghasilkan StepEvent untuk setiap
 * langkah penting; event terakhir selalu { kind: 'done' }.
 * Error dilempar sebagai FriendlyError (pesan Indonesia ramah) — pakai
 * FriendlyErrorTranslator.translate bila perlu menampilkannya sebagai LintError.
 */
export async function* runBotScript(
  code: string,
  botApi: BotApiRegistry,
): AsyncGenerator<StepEvent, void, undefined> {
  let program: AstNode;
  try {
    program = parse(code, {
      ecmaVersion: 2022,
      locations: true,
      sourceType: 'script',
    }) as AstNode;
  } catch (err) {
    throw syntaxError(err);
  }

  const ctx: RunContext = { registry: botApi, loopIterations: 0, callDepth: 0 };
  const globalScope = new Scope(null);
  const body: AstNode[] = Array.isArray(program?.body) ? program.body : [];
  const lastLine = body.length > 0 ? lineOf(body[body.length - 1]) : 1;

  try {
    yield* execStatements(body, globalScope, ctx);
  } catch (err) {
    if (err instanceof FriendlyError) throw err;
    if (err instanceof ReturnSignal) {
      throw typeError(
        "'return' hanya boleh dipakai di dalam function.",
        lastLine,
        'Bungkus kodemu dalam function kalau mau memakai return ya.',
      );
    }
    if (err instanceof BreakSignal || err instanceof ContinueSignal) {
      throw typeError(
        "'break' dan 'continue' hanya boleh dipakai di dalam loop (for / while).",
        lastLine,
      );
    }
    if (err instanceof SyntaxError) throw syntaxError(err);
    throw new FriendlyError(translateError(err));
  }

  yield { line: lastLine, kind: 'done' };
}

/** Namespace sesuai kontrak blueprint §5: StepInterpreter.run(code, botApi). */
export const StepInterpreter = {
  run: runBotScript,
  MAX_LOOP_ITERATIONS,
  MAX_CALL_DEPTH,
};
