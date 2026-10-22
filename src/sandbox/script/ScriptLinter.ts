// ScriptLinter — pemeriksaan kode Bot Script TANPA menjalankannya.
// Memakai acorn untuk parse AST, lalu memeriksa dengan analisis SCOPE
// leksikal (bukan sekadar daftar nama global), supaya putusan linter
// selaras dengan StepInterpreter:
//   1. Error sintaks (diterjemahkan ramah oleh FriendlyErrorTranslator).
//   2. Panggilan fungsi tak dikenal / modul bot yang belum terbuka —
//      termasuk nama yang hanya terjangkau di scope lain (parameter fungsi
//      lain, fungsi di dalam blok) yang dulu lolos diam-diam (SCR-M5).
//   3. Pemakaian variabel sebelum deklarasinya (TDZ) & inisialisasi diri
//      (SCR-M6), panggilan ke angka literal / variabel berisi angka.
//   4. Konstruk yang ditolak interpreter saat jalan: destructuring, class,
//      optional chaining, new, switch, try/catch, label, delete (SCR-M6).
//   5. Penulisan ke data registry (mis. gate.isOpen = ...) — data dunia
//      hanya-baca; mengubahnya wajib lewat fungsi bot (SCR-M2).
//   6. Cabang mati statis (if (false) { ... }, kode sesudah return) TIDAK
//      diperiksa — interpreter pun tidak menjalankannya (SCR-M7).
// Hasilnya LintError[] berbahasa Indonesia (kontrak blueprint §5).
//
// Batasan yang disadari: linter hanya menerima daftar fungsi yang
// diizinkan, jadi root objek registry murni-data (mis. "sensor") tidak
// bisa dibedakan dari variabel yang belum dikenal — bacaan identifier
// yang sama sekali tidak terdeklarasi TIDAK ditandai di sini; itu
// domain interpreter saat jalan (pesannya tetap ramah).

import { parse } from 'acorn';
import type { LintError } from '../../shared/types';
import {
  FriendlyError,
  blankPlaceholderError,
  readOnlyError,
  syntaxError,
  typeError,
  unknownFunctionError,
  unsupportedConstructError,
} from './FriendlyErrorTranslator';
import { staticPath } from './StepInterpreter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = any;

function lineOf(node: AstNode): number {
  return typeof node?.loc?.start?.line === 'number' ? node.loc.start.line : 1;
}

function columnOf(node: AstNode): number {
  return typeof node?.loc?.start?.column === 'number' ? node.loc.start.column : 0;
}

/* ------------------------------ model scope ------------------------------ */

interface DeclInfo {
  line: number;
  column: number;
  /** Kedalaman fungsi saat deklarasi dibuat (0 = tingkat atas). */
  fnDepth: number;
  kind: 'var' | 'function' | 'param';
  /** true bila diinisialisasi literal angka — pasti bukan fungsi. */
  literalNumber: boolean;
}

interface LintScope {
  parent: LintScope | null;
  decls: Map<string, DeclInfo>;
}

function newScope(parent: LintScope | null): LintScope {
  return { parent, decls: new Map() };
}

function resolveDecl(scope: LintScope, name: string): DeclInfo | null {
  let s: LintScope | null = scope;
  while (s) {
    const found = s.decls.get(name);
    if (found) return found;
    s = s.parent;
  }
  return null;
}

/** Literal yang nilainya falsy (false, 0, '', null) — cabang matinya statis. */
function isFalsyLiteral(node: AstNode): boolean {
  return node?.type === 'Literal' && !node.value;
}

function isTruthyLiteral(node: AstNode): boolean {
  return node?.type === 'Literal' && Boolean(node.value);
}

/* -------------------------------- analyzer ------------------------------- */

class LintAnalyzer {
  private readonly allowed: Set<string>;
  /** Segmen pertama dari nama yang diizinkan: root modul bot ("piko", "gate"). */
  private readonly apiRoots: Set<string>;
  private readonly errors: LintError[] = [];
  private readonly seen = new Set<string>();
  private fnDepth = 0;
  /** Deklarasi yang initializer-nya sedang dianalisis (deteksi `let x = x`). */
  private readonly initializing = new Set<DeclInfo>();

  constructor(allowedFunctions: string[]) {
    this.allowed = new Set(allowedFunctions);
    this.apiRoots = new Set(allowedFunctions.map((n) => n.split('.')[0]));
  }

  run(program: AstNode): LintError[] {
    const global = newScope(null);
    this.analyzeBlock(Array.isArray(program?.body) ? program.body : [], global);
    this.errors.sort((a, b) => a.line - b.line);
    return this.errors;
  }

  private push(fe: FriendlyError): void {
    const le = fe.toLintError();
    const key = `${le.line}|${le.message}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.errors.push(le);
  }

  /** Error "modul tidak dikenal" — blanko ___ dapat pesan khususnya. */
  private pushUnknown(name: string, line: number): void {
    const lastSegment = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name;
    if (/^_+$/.test(lastSegment)) {
      this.push(blankPlaceholderError(line));
      return;
    }
    this.push(unknownFunctionError(name, line, this.allowed));
  }

  /* ------------------------------ blok & hoist ----------------------------- */

  /** Daftarkan deklarasi satu blok SEBELUM isinya dianalisis (hoisting),
   * supaya pemakaian-sebelum-deklarasi bisa dideteksi dari posisinya. */
  private hoist(stmts: AstNode[], scope: LintScope): void {
    for (const stmt of stmts) {
      if (!stmt) continue;
      if (stmt.type === 'FunctionDeclaration' && stmt.id?.name) {
        scope.decls.set(stmt.id.name, {
          line: lineOf(stmt.id),
          column: columnOf(stmt.id),
          fnDepth: this.fnDepth,
          kind: 'function',
          literalNumber: false,
        });
      }
      if (stmt.type === 'VariableDeclaration') {
        for (const d of stmt.declarations ?? []) {
          if (d?.id?.type === 'Identifier') {
            scope.decls.set(d.id.name, {
              line: lineOf(d.id),
              column: columnOf(d.id),
              fnDepth: this.fnDepth,
              kind: 'var',
              literalNumber:
                d.init?.type === 'Literal' && typeof d.init.value === 'number',
            });
          }
        }
      }
    }
  }

  private analyzeBlock(stmts: AstNode[], scope: LintScope): void {
    this.hoist(stmts, scope);
    for (const stmt of stmts) {
      if (!stmt) continue;
      this.analyzeStmt(stmt, scope);
      // Kode sesudah `return` di blok yang sama tidak pernah jalan (SCR-M7).
      if (stmt.type === 'ReturnStatement') break;
    }
  }

  /* ------------------------------- statements ------------------------------ */

  private analyzeStmt(node: AstNode, scope: LintScope): void {
    switch (node?.type) {
      case 'VariableDeclaration':
        this.analyzeVarDecl(node, scope);
        return;
      case 'FunctionDeclaration':
        this.analyzeFunction(node, scope);
        return;
      case 'ExpressionStatement':
        this.analyzeExpr(node.expression, scope);
        return;
      case 'ReturnStatement':
      case 'ThrowStatement':
        if (node.argument) this.analyzeExpr(node.argument, scope);
        return;
      case 'BlockStatement':
        this.analyzeBlock(node.body ?? [], newScope(scope));
        return;
      case 'IfStatement': {
        this.analyzeExpr(node.test, scope);
        if (isFalsyLiteral(node.test)) {
          if (node.alternate) this.analyzeStmt(node.alternate, scope);
        } else if (isTruthyLiteral(node.test)) {
          this.analyzeStmt(node.consequent, scope);
        } else {
          this.analyzeStmt(node.consequent, scope);
          if (node.alternate) this.analyzeStmt(node.alternate, scope);
        }
        return;
      }
      case 'WhileStatement':
        this.analyzeExpr(node.test, scope);
        if (!isFalsyLiteral(node.test)) this.analyzeStmt(node.body, scope);
        return;
      case 'DoWhileStatement':
        // Badan do-while selalu jalan minimal sekali — tetap diperiksa.
        this.analyzeStmt(node.body, scope);
        this.analyzeExpr(node.test, scope);
        return;
      case 'ForStatement': {
        const loopScope = newScope(scope);
        if (node.init) {
          if (node.init.type === 'VariableDeclaration') {
            this.hoist([node.init], loopScope);
            this.analyzeVarDecl(node.init, loopScope);
          } else {
            this.analyzeExpr(node.init, loopScope);
          }
        }
        if (node.test) this.analyzeExpr(node.test, loopScope);
        if (node.update) this.analyzeExpr(node.update, loopScope);
        if (!isFalsyLiteral(node.test)) this.analyzeStmt(node.body, loopScope);
        return;
      }
      case 'ForInStatement':
      case 'ForOfStatement': {
        const loopScope = newScope(scope);
        const left = node.left;
        if (left?.type === 'VariableDeclaration') {
          this.hoist([left], loopScope);
          for (const d of left.declarations ?? []) {
            if (d?.id && d.id.type !== 'Identifier') {
              this.push(unsupportedConstructError('destructuring', lineOf(d.id)));
            }
          }
        } else if (left) {
          this.analyzeExpr(left, loopScope);
        }
        this.analyzeExpr(node.right, scope);
        this.analyzeStmt(node.body, loopScope);
        return;
      }
      case 'LabeledStatement':
        this.push(unsupportedConstructError('label', lineOf(node)));
        this.analyzeStmt(node.body, scope);
        return;
      case 'SwitchStatement':
        this.push(unsupportedConstructError('switch', lineOf(node)));
        return; // isi switch tidak diturunkan — satu error cukup
      case 'TryStatement':
        this.push(unsupportedConstructError('try', lineOf(node)));
        return;
      case 'ClassDeclaration':
      case 'ClassExpression':
        this.push(unsupportedConstructError('class', lineOf(node)));
        return;
      default:
        return; // break/continue/empty/debugger: tidak ada yang diperiksa
    }
  }

  private analyzeVarDecl(node: AstNode, scope: LintScope): void {
    for (const d of node.declarations ?? []) {
      if (!d) continue;
      if (d.id?.type !== 'Identifier') {
        // Destructuring (let [a] = ..., let {x} = ...) — belum didukung.
        this.push(unsupportedConstructError('destructuring', lineOf(d.id ?? node)));
        if (d.init) this.analyzeExpr(d.init, scope);
        continue;
      }
      if (d.init) {
        const info = scope.decls.get(d.id.name as string);
        if (info) this.initializing.add(info);
        this.analyzeExpr(d.init, scope);
        if (info) this.initializing.delete(info);
      }
    }
  }

  /** Analisis badan fungsi (deklarasi maupun ekspresi/arrow). */
  private analyzeFunction(node: AstNode, scope: LintScope): void {
    const fnScope = newScope(scope);
    this.fnDepth += 1;
    try {
      for (const p of node.params ?? []) {
        if (p?.type === 'Identifier') {
          fnScope.decls.set(p.name, {
            line: lineOf(p),
            column: columnOf(p),
            fnDepth: this.fnDepth,
            kind: 'param',
            literalNumber: false,
          });
        } else if (p?.type === 'AssignmentPattern' && p.left?.type === 'Identifier') {
          fnScope.decls.set(p.left.name, {
            line: lineOf(p.left),
            column: columnOf(p.left),
            fnDepth: this.fnDepth,
            kind: 'param',
            literalNumber: false,
          });
          if (p.right) this.analyzeExpr(p.right, fnScope);
        } else if (p) {
          this.push(unsupportedConstructError('destructuring', lineOf(p)));
        }
      }
      if (node.body?.type === 'BlockStatement') {
        // Parameter & deklarasi badan berbagi scope fungsi (seperti runtime).
        this.analyzeBlock(node.body.body ?? [], fnScope);
      } else if (node.body) {
        // Badan ekspresi arrow: hasilnya nilai return (SCR-M3) — periksa juga.
        this.analyzeExpr(node.body, fnScope);
      }
    } finally {
      this.fnDepth -= 1;
    }
  }

  /* ------------------------------- expressions ----------------------------- */

  /** Periksa bacaan satu identifier: hanya TDZ yang ditandai (lihat header). */
  private checkRead(node: AstNode, scope: LintScope): void {
    const name = node.name as string;
    const decl = resolveDecl(scope, name);
    if (!decl) return; // tak terdeklarasi: domain interpreter (akar registry tak dikenal linter)
    if (decl.kind === 'function') return; // deklarasi fungsi ter-hoist: selalu aman
    if (decl.fnDepth !== this.fnDepth) return; // bacaan di dalam closure: dinilai saat dipanggil
    const line = lineOf(node);
    const usedBefore =
      line < decl.line || (line === decl.line && columnOf(node) < decl.column);
    if (this.initializing.has(decl) || usedBefore) {
      this.push(
        typeError(
          `'${name}' dipakai di baris ${line} sebelum sempat dibuat — deklarasinya baru muncul di baris ${decl.line}.`,
          line,
          `Pindahkan baris pembuatan '${name}' ke atas, sebelum dipakai ya.`,
        ),
      );
    }
  }

  /** Tulis ke member registry (gate.isOpen = ...) → data dunia hanya-baca. */
  private checkRegistryWrite(memberNode: AstNode, scope: LintScope): void {
    const path = staticPath(memberNode);
    if (!path) return;
    const root = path.split('.')[0];
    if (!this.apiRoots.has(root)) return;
    if (resolveDecl(scope, root)) return; // ditimpa variabel pemain: objek miliknya sendiri
    this.push(readOnlyError(path, lineOf(memberNode)));
  }

  private analyzeCall(node: AstNode, scope: LintScope): void {
    const callee: AstNode = node.callee;
    const line = lineOf(node);

    if (callee?.type === 'ChainExpression') {
      this.push(unsupportedConstructError('optionalChaining', lineOf(callee)));
      this.analyzeExpr(callee.expression, scope);
    } else if (callee?.type === 'Literal') {
      this.push(
        typeError(
          `Di baris ${line}, yang dipanggil bukan fungsi — itu cuma nilai biasa.`,
          line,
          'Yang bisa dipanggil cuma fungsi: modul Piko (misalnya piko.boot) atau fungsi buatanmu sendiri.',
        ),
      );
    } else if (callee?.type === 'Identifier') {
      const name = callee.name as string;
      const decl = resolveDecl(scope, name);
      if (decl) {
        if (decl.literalNumber) {
          this.push(
            typeError(
              `'${name}' di baris ${line} isinya angka, jadi tidak bisa dipanggil seperti fungsi.`,
              line,
              'Angka tidak bisa dipanggil — hapus tanda () di belakangnya ya.',
            ),
          );
        }
        // Terdeklarasi & terlihat dari sini: fungsi/var pemain — sah.
      } else if (!this.allowed.has(name)) {
        // Tidak terlihat dari scope ini (atau memang tidak ada): sama
        // seperti yang akan dikatakan interpreter saat jalan (SCR-M5).
        this.pushUnknown(name, line);
      }
    } else if (callee?.type === 'MemberExpression') {
      const path = staticPath(callee);
      if (!path) {
        this.analyzeExpr(callee, scope);
      } else {
        const root = path.split('.')[0];
        const rootDecl = resolveDecl(scope, root);
        if (rootDecl) {
          // Metode pada objek lokal pemain (termasuk root yang menimpa
          // nama registry, SCR-M4) — bukan urusan registry.
        } else if (this.allowed.has(path)) {
          // Modul bot yang terbuka untuk quest ini.
        } else if (root === 'Math') {
          const seg = path.slice(path.lastIndexOf('.') + 1);
          const fn = (Math as unknown as Record<string, unknown>)[seg];
          if (typeof fn !== 'function') this.pushUnknown(path, line);
        } else {
          this.pushUnknown(path, line);
        }
        // Kunci terhitung pada callee tetap diperiksa isinya.
        if (callee.computed) this.analyzeExpr(callee.property, scope);
        if (callee.object?.type !== 'Identifier') this.analyzeExpr(callee.object, scope);
      }
    } else if (callee) {
      this.analyzeExpr(callee, scope);
    }

    for (const arg of node.arguments ?? []) this.analyzeExpr(arg, scope);
  }

  private analyzeExpr(node: AstNode, scope: LintScope): void {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Identifier':
        this.checkRead(node, scope);
        return;
      case 'Literal':
      case 'ThisExpression':
        return;
      case 'MemberExpression':
        this.analyzeExpr(node.object, scope);
        if (node.computed) this.analyzeExpr(node.property, scope);
        return;
      case 'ChainExpression':
        this.push(unsupportedConstructError('optionalChaining', lineOf(node)));
        this.analyzeExpr(node.expression, scope);
        return;
      case 'CallExpression':
        this.analyzeCall(node, scope);
        return;
      case 'NewExpression':
        this.push(unsupportedConstructError('new', lineOf(node)));
        for (const arg of node.arguments ?? []) this.analyzeExpr(arg, scope);
        return;
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        this.analyzeFunction(node, scope);
        return;
      case 'AssignmentExpression': {
        const left = node.left;
        if (left?.type === 'ObjectPattern' || left?.type === 'ArrayPattern') {
          this.push(unsupportedConstructError('destructuring', lineOf(left)));
        } else if (left?.type === 'MemberExpression') {
          this.checkRegistryWrite(left, scope);
          this.analyzeExpr(left, scope);
        }
        this.analyzeExpr(node.right, scope);
        return;
      }
      case 'UpdateExpression':
        if (node.argument?.type === 'MemberExpression') {
          this.checkRegistryWrite(node.argument, scope);
          this.analyzeExpr(node.argument, scope);
        } else if (node.argument?.type === 'Identifier') {
          this.checkRead(node.argument, scope);
        }
        return;
      case 'UnaryExpression':
        if (node.operator === 'delete') {
          this.push(unsupportedConstructError('delete', lineOf(node)));
          return;
        }
        // typeof <identifier> aman walau belum dikenal (L22/L23) — lewati.
        if (node.operator === 'typeof' && node.argument?.type === 'Identifier') return;
        this.analyzeExpr(node.argument, scope);
        return;
      case 'BinaryExpression':
      case 'LogicalExpression':
        this.analyzeExpr(node.left, scope);
        this.analyzeExpr(node.right, scope);
        return;
      case 'ConditionalExpression':
        this.analyzeExpr(node.test, scope);
        if (isFalsyLiteral(node.test)) {
          this.analyzeExpr(node.alternate, scope);
        } else if (isTruthyLiteral(node.test)) {
          this.analyzeExpr(node.consequent, scope);
        } else {
          this.analyzeExpr(node.consequent, scope);
          this.analyzeExpr(node.alternate, scope);
        }
        return;
      case 'TemplateLiteral':
        for (const e of node.expressions ?? []) this.analyzeExpr(e, scope);
        return;
      case 'ArrayExpression':
        for (const el of node.elements ?? []) if (el) this.analyzeExpr(el, scope);
        return;
      case 'ObjectExpression':
        for (const prop of node.properties ?? []) {
          if (!prop) continue;
          if (prop.type === 'SpreadElement') {
            this.analyzeExpr(prop.argument, scope);
          } else {
            if (prop.computed) this.analyzeExpr(prop.key, scope);
            this.analyzeExpr(prop.value, scope);
          }
        }
        return;
      case 'SpreadElement':
      case 'AwaitExpression':
      case 'YieldExpression':
        this.analyzeExpr(node.argument, scope);
        return;
      case 'SequenceExpression':
        for (const e of node.expressions ?? []) this.analyzeExpr(e, scope);
        return;
      case 'TaggedTemplateExpression':
        this.analyzeExpr(node.tag, scope);
        for (const e of node.quasi?.expressions ?? []) this.analyzeExpr(e, scope);
        return;
      default:
        // Jaring pengaman: telusuri anak AST yang belum dikenal jenisnya.
        for (const key of Object.keys(node)) {
          if (key === 'loc' || key === 'range' || key === 'start' || key === 'end') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            for (const c of child) {
              if (c && typeof c.type === 'string') this.analyzeExpr(c, scope);
            }
          } else if (child && typeof child.type === 'string') {
            this.analyzeExpr(child, scope);
          }
        }
        return;
    }
  }
}

/* --------------------------------- driver -------------------------------- */

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

  try {
    return new LintAnalyzer(allowedFunctions).run(program);
  } catch {
    // Analisis tidak boleh melempar (mis. RangeError pada kode yang sangat
    // dalam bersarang) — RUN tidak boleh terkunci oleh kegagalan linter.
    return [];
  }
}

/** Namespace sesuai gaya kontrak blueprint §5. */
export const ScriptLinter = {
  lint: lintScript,
};
