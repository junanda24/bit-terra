import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Decoration,
  EditorView,
  GutterMarker,
  drawSelection,
  gutter,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import {
  Compartment,
  EditorState,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from '@codemirror/state';
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StringStream,
} from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { tags } from '@lezer/highlight';
import type { LintError } from '../../shared/types';
import { SoundController } from '../../core/audio/SoundController';
import { TypingParticleCanvas, type TypingParticleCanvasHandle } from './TypingParticleCanvas';

/* ------------------------------------------------------------------ */
/* Bahasa mini (StreamLanguage) — ringan, tanpa paket lang tambahan    */
/* ------------------------------------------------------------------ */

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'order', 'by', 'group', 'having', 'limit', 'offset',
  'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'on', 'as',
  'update', 'set', 'insert', 'into', 'values', 'delete', 'create', 'table',
  'and', 'or', 'not', 'null', 'asc', 'desc', 'distinct', 'count', 'sum',
  'avg', 'min', 'max', 'commit', 'rollback', 'begin', 'transaction', 'case',
  'when', 'then', 'else', 'end', 'between', 'like', 'in', 'is', 'exists',
]);

function sqlToken(stream: StringStream): string | null {
  if (stream.eatSpace()) return null;
  const ch = stream.next();
  if (ch === '-' && stream.eat('-')) {
    stream.skipToEnd();
    return 'comment';
  }
  if (ch === "'") {
    let escaped = false;
    while (!stream.eol()) {
      const c = stream.next();
      if (c === "'" && !escaped) break;
      escaped = c === "'" && escaped ? false : c === '\\';
      if (c === "'" && stream.peek() === "'") stream.next();
    }
    return 'string';
  }
  if (ch !== undefined && /[0-9]/.test(ch)) {
    stream.match(/^[0-9]*\.?[0-9]*/);
    return 'number';
  }
  if (ch !== undefined && /[A-Za-z_]/.test(ch)) {
    stream.match(/^[A-Za-z0-9_]*/);
    return SQL_KEYWORDS.has(stream.current().toLowerCase()) ? 'keyword' : 'variableName';
  }
  return 'operator';
}

const sqlLanguage = StreamLanguage.define<null>({
  startState: () => null,
  token: sqlToken,
  languageData: { commentTokens: { line: '--' } },
});

const BOT_KEYWORDS = new Set([
  'function', 'let', 'const', 'var', 'if', 'else', 'for', 'while', 'return',
  'true', 'false', 'of', 'new', 'break', 'continue',
]);
const BOT_API_ROOTS = new Set(['piko', 'gate', 'sensor', 'world']);

function botToken(stream: StringStream): string | null {
  if (stream.eatSpace()) return null;
  const ch = stream.next();
  if (ch === '/' && stream.eat('/')) {
    stream.skipToEnd();
    return 'comment';
  }
  if (ch === "'" || ch === '"' || ch === '`') {
    while (!stream.eol()) {
      const c = stream.next();
      if (c === ch) break;
      if (c === '\\') stream.next();
    }
    return 'string';
  }
  if (ch !== undefined && /[0-9]/.test(ch)) {
    stream.match(/^[0-9]*\.?[0-9]*/);
    return 'number';
  }
  if (ch !== undefined && /[A-Za-z_$]/.test(ch)) {
    stream.match(/^[A-Za-z0-9_$]*/);
    const word = stream.current();
    if (BOT_KEYWORDS.has(word)) return 'keyword';
    if (BOT_API_ROOTS.has(word)) return 'atom';
    if (stream.eat('.')) {
      stream.backUp(1);
      return 'variableName';
    }
    return 'variableName';
  }
  return 'operator';
}

const botLanguage = StreamLanguage.define<null>({
  startState: () => null,
  token: botToken,
  languageData: { commentTokens: { line: '//' } },
});

/* ------------------------------------------------------------------ */
/* Gaya sorot: amber fosfor di atas slate, keyword SQL mint (§4)       */
/* ------------------------------------------------------------------ */

const sqlHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#00f5d4', fontWeight: '700' },
  { tag: tags.string, color: '#f4b41b' },
  { tag: tags.number, color: '#ff9e64' },
  { tag: tags.comment, color: '#5b6b7f', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#ffd489' },
  { tag: tags.operator, color: '#ffb000' },
]);

const botHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#00f5d4', fontWeight: '700' },
  { tag: tags.atom, color: '#f4b41b', fontWeight: '700' },
  { tag: tags.string, color: '#ffd489' },
  { tag: tags.number, color: '#ff9e64' },
  { tag: tags.comment, color: '#5b6b7f', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#e8dfc8' },
  { tag: tags.operator, color: '#ffb000' },
]);

const editorTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#141820', color: '#ffcf7d', height: '100%' },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-content': {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '14.5px',
      lineHeight: '1.6',
      caretColor: '#ffb000',
      padding: '10px 0',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#ffb000', borderLeftWidth: '2px' },
    '.cm-gutters': {
      backgroundColor: '#10131a',
      color: '#54606f',
      borderRight: '1px solid #232a38',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(255,176,0,0.055)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255,176,0,0.08)', color: '#ffb000' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(0,245,212,0.16)',
    },
    '.cm-bt-lint-error': {
      textDecoration: 'underline wavy #ff4d6d 1.2px',
      textUnderlineOffset: '3px',
    },
    '.cm-bt-lint-line': { backgroundColor: 'rgba(255,77,109,0.06)' },
    '.cm-bt-exec-line': {
      backgroundColor: 'rgba(255,176,0,0.2)',
      boxShadow: 'inset 3px 0 0 #ffb000',
    },
    '.cm-bt-lint-gutter': { width: '13px' },
    '.cm-placeholder': { color: '#54606f', fontStyle: 'italic' },
  },
  { dark: true },
);

/* ------------------------------------------------------------------ */
/* Field dekorasi: lint (garis bawah bergelombang + penanda gutter)    */
/* dan highlight baris yang sedang dieksekusi                          */
/* ------------------------------------------------------------------ */

const setLintErrors = StateEffect.define<LintError[]>();
const setExecLine = StateEffect.define<number | null>();

class LintGutterMarker extends GutterMarker {
  readonly message: string;
  constructor(message: string) {
    super();
    this.message = message;
  }
  override eq(other: GutterMarker): boolean {
    return other instanceof LintGutterMarker && other.message === this.message;
  }
  override toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.textContent = '●';
    el.title = this.message;
    el.style.cssText = 'color:#ff4d6d;font-size:9px;line-height:1;display:block;text-align:center;';
    return el;
  }
}

interface LintFieldValue {
  deco: RangeSet<Decoration>;
  markers: RangeSet<GutterMarker>;
}

function buildLintValue(state: EditorState, errors: LintError[]): LintFieldValue {
  const deco = new RangeSetBuilder<Decoration>();
  const markers = new RangeSetBuilder<GutterMarker>();
  const sorted = [...errors].sort((a, b) => a.line - b.line);
  for (const err of sorted) {
    if (err.line < 1 || err.line > state.doc.lines) continue;
    const line = state.doc.line(err.line);
    deco.add(line.from, line.from, Decoration.line({ class: 'cm-bt-lint-line' }));
    let from = line.from;
    if (err.column !== undefined && err.column >= 1) {
      from = Math.min(line.to, line.from + err.column - 1);
    } else {
      const text = line.text;
      const firstNonSpace = text.search(/\S/);
      from = line.from + (firstNonSpace >= 0 ? firstNonSpace : 0);
    }
    let to = from;
    while (to < line.to && /[\w]/.test(state.doc.sliceString(to, to + 1))) to++;
    if (to === from) to = Math.min(line.to, from + 1);
    if (to > from) {
      deco.add(from, to, Decoration.mark({ class: 'cm-bt-lint-error' }));
    }
    markers.add(line.from, line.from, new LintGutterMarker(err.message));
  }
  return { deco: deco.finish(), markers: markers.finish() };
}

const lintField = StateField.define<LintFieldValue>({
  create: () => ({ deco: Decoration.none, markers: RangeSet.empty }),
  update(value, tr) {
    let next = value;
    for (const e of tr.effects) {
      if (e.is(setLintErrors)) {
        next = buildLintValue(tr.state, e.value);
      }
    }
    if (next === value && tr.docChanged) {
      // Posisi dekorasi bergeser mengikuti edit — bangun ulang dari efek
      // terakhir tidak tersedia; cara aman: petakan dekorasi lama.
      return {
        deco: value.deco.map(tr.changes),
        markers: value.markers.map(tr.changes),
      } as LintFieldValue;
    }
    return next;
  },
  provide: (f) => [
    EditorView.decorations.from(f, (v) => v.deco),
    gutter({
      class: 'cm-bt-lint-gutter',
      markers: (view) => view.state.field(f).markers,
    }),
  ],
});

const execLineField = StateField.define<RangeSet<Decoration>>({
  create: () => Decoration.none,
  update(value, tr) {
    let deco = value.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setExecLine)) {
        if (e.value === null || e.value < 1 || e.value > tr.state.doc.lines) {
          deco = Decoration.none;
        } else {
          const line = tr.state.doc.line(e.value);
          deco = RangeSet.of([
            Decoration.line({ class: 'cm-bt-exec-line' }).range(line.from),
          ]);
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/* ------------------------------------------------------------------ */
/* Komponen editor                                                     */
/* ------------------------------------------------------------------ */

export type EditorMode = 'SQL' | 'BOT_SCRIPT' | 'HYBRID';

export interface InteractiveEditorProps {
  value: string;
  onChange: (code: string) => void;
  mode: EditorMode;
  lintErrors?: LintError[];
  /** Baris yang sedang dieksekusi (1-based) — disorot kuning terang. */
  currentLine?: number | null;
  readOnly?: boolean;
  autoFocus?: boolean;
  /** Callback koordinat piksel kursor (relatif ke bungkus editor) per ketukan. */
  onKeystrokeBurst?: (x: number, y: number) => void;
  className?: string;
}

export function InteractiveEditor({
  value,
  onChange,
  mode,
  lintErrors = [],
  currentLine = null,
  readOnly = false,
  autoFocus = false,
  onKeystrokeBurst,
  className = '',
}: InteractiveEditorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const particleRef = useRef<TypingParticleCanvasHandle | null>(null);
  const langCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBurstRef = useRef(onKeystrokeBurst);
  onBurstRef.current = onKeystrokeBurst;
  const suppressRef = useRef(false);
  const streakRef = useRef(0);
  const [streak, setStreak] = useState(0);

  // --- buat EditorView sekali ---
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const isSql = mode !== 'BOT_SCRIPT';
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        langCompartment.current.of([
          isSql ? sqlLanguage : botLanguage,
          syntaxHighlighting(isSql ? sqlHighlight : botHighlight),
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        cmPlaceholder(
          isSql
            ? 'Tulis query SQL di sini… misalnya SELECT nama FROM warga'
            : 'Tulis program untuk Piko… misalnya piko.boot();',
        ),
        editorTheme,
        lintField,
        execLineField,
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !suppressRef.current) {
            onChangeRef.current(u.state.doc.toString());
          }
        }),
        EditorView.domEventHandlers({
          keydown(event, view) {
            if (event.metaKey || event.ctrlKey || event.altKey) return false;
            if (['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) return false;
            try {
              SoundController.playKeystroke();
            } catch {
              // Audio belum siap — mengetik tetap jalan.
            }
            if (event.key === 'Backspace' || event.key === 'Delete') {
              streakRef.current = 0;
              setStreak(0);
            } else {
              streakRef.current += 1;
              setStreak(streakRef.current);
            }
            requestAnimationFrame(() => {
              const v = viewRef.current;
              const wrap = wrapRef.current;
              if (!v || !wrap || v !== view) return;
              const coords = v.coordsAtPos(v.state.selection.main.head);
              if (!coords) return;
              const rect = wrap.getBoundingClientRect();
              const x = coords.left - rect.left;
              const y = coords.top - rect.top + 8;
              particleRef.current?.spawnBurst(x, y);
              onBurstRef.current?.(x, y);
            });
            return false;
          },
          blur() {
            streakRef.current = 0;
            setStreak(0);
          },
        }),
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    if (autoFocus) view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Editor hanya dibuat sekali; mode/readOnly diperbarui lewat compartment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- sinkronkan nilai dari luar (cartridge, reset, muat simpanan) ---
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      suppressRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      suppressRef.current = false;
    }
  }, [value]);

  // --- mode & readOnly ---
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const isSql = mode !== 'BOT_SCRIPT';
    view.dispatch({
      effects: langCompartment.current.reconfigure([
        isSql ? sqlLanguage : botLanguage,
        syntaxHighlighting(isSql ? sqlHighlight : botHighlight),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [mode, readOnly]);

  // --- lint & baris eksekusi ---
  useEffect(() => {
    viewRef.current?.dispatch({ effects: setLintErrors.of(lintErrors) });
  }, [lintErrors]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setExecLine.of(currentLine) });
    if (currentLine !== null && currentLine >= 1 && currentLine <= view.state.doc.lines) {
      const pos = view.state.doc.line(currentLine).from;
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    }
  }, [currentLine]);

  return (
    <div ref={wrapRef} className={`relative h-full min-h-0 ${className}`}>
      <div ref={hostRef} className="h-full [&_.cm-editor]:h-full" />
      <TypingParticleCanvas ref={particleRef} />
      <AnimatePresence>
        {streak >= 8 ? (
          <motion.div
            key="streak"
            initial={{ opacity: 0, y: -6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="pointer-events-none absolute right-3 top-2 z-40 rounded-[3px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{
              fontFamily: "'Pixelify Sans', sans-serif",
              backgroundColor: 'rgba(11,14,20,0.85)',
              color: '#00f5d4',
              border: '1.5px solid rgba(0,245,212,0.5)',
            }}
          >
            +{streak} Keystroke Streak
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default InteractiveEditor;
