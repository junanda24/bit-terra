// FriendlyErrorTranslator — semua error sandbox diterjemahkan menjadi pesan
// Bahasa Indonesia yang ramah dengan suara Piko (maskot robot Bit-Terra).
// TIDAK PERNAH menampilkan stack trace mentah ke pemain (docs/BLUEPRINT.md §5).

import type { LintError } from '../../shared/types';

/** Error yang sudah "ramah" — membawa baris + saran, siap ditampilkan ke UI. */
export class FriendlyError extends Error {
  readonly line: number;
  readonly column?: number;
  readonly suggestion?: string;

  constructor(lint: LintError) {
    super(lint.message);
    this.name = 'FriendlyError';
    this.line = lint.line;
    this.column = lint.column;
    this.suggestion = lint.suggestion;
  }

  toLintError(): LintError {
    const out: LintError = { line: this.line, message: this.message };
    if (this.column !== undefined) out.column = this.column;
    if (this.suggestion !== undefined) out.suggestion = this.suggestion;
    return out;
  }
}

/** Jarak edit Levenshtein kecil untuk saran "apakah maksudmu ...?". */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Kandidat terdekat dari daftar nama (atau undefined kalau terlalu jauh). */
export function closestName(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = editDistance(name.toLowerCase(), c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  const limit = Math.max(2, Math.floor(name.length / 2));
  return bestDist <= limit ? best : undefined;
}

interface AcornLikeError {
  message?: string;
  loc?: { line: number; column: number };
  pos?: number;
}

/** Error sintaks dari acorn → pesan ramah berbahasa Indonesia. */
export function syntaxError(err: unknown): FriendlyError {
  const e = (err ?? {}) as AcornLikeError;
  const line = e.loc?.line ?? 1;
  const column = e.loc?.column;
  const raw = typeof e.message === 'string' ? e.message : '';
  let suggestion = 'Coba cek lagi tanda kurung ( ), kurung kurawal { }, dan tanda titik koma di sekitar baris ini.';
  if (/unterminated string/i.test(raw)) {
    suggestion = 'Ada teks di dalam tanda kutip yang belum ditutup. Tambahkan tanda kutip penutupnya ya.';
  } else if (/unexpected end of input/i.test(raw)) {
    suggestion = 'Kodenya seperti terpotong di tengah jalan — mungkin ada kurung yang belum ditutup.';
  } else if (/unexpected token/i.test(raw)) {
    suggestion = 'Ada simbol yang muncul di tempat yang tidak terduga. Cek koma, titik koma, dan tanda kurung di baris ini.';
  } else if (/assigning to/i.test(raw) || /invalid left-hand side/i.test(raw)) {
    suggestion = 'Sisi kiri tanda = harus nama variabel, misalnya: let langkah = 3;';
  }
  return new FriendlyError({
    line,
    column,
    message: `Hmm, Piko bingung membaca baris ${line}. Sepertinya ada yang kurang pas di kodenya.`,
    suggestion,
  });
}

/** Fungsi/modul yang tidak ada di registry Bot API. */
export function unknownFunctionError(name: string, line: number, allowed: Iterable<string>): FriendlyError {
  const allowedList = [...allowed];
  // Saran HANYA boleh menyebut fungsi yang benar-benar ada di daftar
  // allowed — dan dibatasi ke objek yang sama dengan yang dipanggil pemain
  // (piko.* tidak pernah dicampur gate.*, dst.), supaya tidak pernah muncul
  // kombinasi karangan seperti "gate.charge" (temuan playtest F-10).
  const root = name.includes('.') ? name.slice(0, name.indexOf('.')) : null;
  const scoped =
    root !== null ? allowedList.filter((a) => a.startsWith(`${root}.`)) : allowedList;
  const pool = scoped.length > 0 ? scoped : allowedList;
  const short = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name;
  const guess = closestName(short, pool.map((a) => (a.includes('.') ? a.slice(a.lastIndexOf('.') + 1) : a)));
  let suggestion: string;
  if (guess) {
    const full = pool.find((a) => a.endsWith(guess));
    suggestion = `Apakah maksudmu ${full ?? guess}()? Cek lagi ejaan nama fungsinya ya.`;
  } else if (pool.length > 0) {
    suggestion = `Modul yang Piko punya sekarang: ${pool.join(', ')}.`;
  } else {
    suggestion = 'Quest ini belum membuka modul apa pun untuk Piko.';
  }
  return new FriendlyError({
    line,
    message: `Piko belum punya modul '${name}'. Mungkin modul itu belum terbuka di quest ini.`,
    suggestion,
  });
}

/** LoopGuard: total iterasi loop melewati batas (blueprint: maks 500 ticks). */
export function loopGuardError(line: number): FriendlyError {
  return new FriendlyError({
    line,
    message: 'Loop-nya tidak berhenti — Piko pusing! Cek kondisi berhentinya.',
    suggestion:
      'Pastikan kondisi loop bisa berubah jadi false, misalnya hitungan yang naik terus sampai batasnya. Batas aman Piko: 500 putaran untuk satu kali Run.',
  });
}

/** Error tipe nilai: memanggil yang bukan fungsi, mengulang yang bukan daftar, dsb. */
export function typeError(message: string, line: number, suggestion?: string): FriendlyError {
  const lint: LintError = { line, message };
  if (suggestion !== undefined) lint.suggestion = suggestion;
  return new FriendlyError(lint);
}

/** Variabel dibaca sebelum dibuat. */
export function undefinedVariableError(name: string, line: number): FriendlyError {
  return new FriendlyError({
    line,
    message: `Piko tidak menemukan variabel '${name}' di baris ${line}.`,
    suggestion: `Kenalkan dulu variabelnya, misalnya: let ${name} = 0; sebelum dipakai.`,
  });
}

/**
 * Terjemahkan error APA PUN dari sandbox menjadi LintError ramah.
 * Fungsi inilah yang dipakai UI — tidak pernah mengembalikan stack trace.
 */
export function translateError(err: unknown): LintError {
  if (err instanceof FriendlyError) return err.toLintError();
  if (err instanceof SyntaxError) return syntaxError(err).toLintError();
  const e = (err ?? {}) as AcornLikeError;
  if (e && typeof e === 'object' && 'loc' in e && e.loc) {
    return syntaxError(err).toLintError();
  }
  if (err instanceof TypeError) {
    return {
      line: 1,
      message: 'Ada nilai yang dipakai dengan cara yang tidak cocok. Piko menghentikan jalannya kode supaya aman.',
      suggestion: 'Cek lagi tipe nilainya: angka dipakai untuk hitungan, teks untuk tulisan, dan daftar untuk diulang satu-satu.',
    };
  }
  return {
    line: 1,
    message: 'Ups, ada yang tidak beres saat kode dijalankan. Piko menghentikannya supaya desa tetap aman.',
    suggestion: 'Coba baca lagi kodemu pelan-pelan dari baris paling atas. Kamu pasti bisa!',
  };
}

/** Namespace sesuai kontrak blueprint §5. */
export const FriendlyErrorTranslator = {
  translate: translateError,
  syntax: syntaxError,
  unknownFunction: unknownFunctionError,
  loopGuard: loopGuardError,
  type: typeError,
  undefinedVariable: undefinedVariableError,
};
