// SqlRuntimeError — klasifikasi error runtime SQLite untuk narasi jujur
// (audit SQL-M1).
//
// Sebagian query lolos linter tapi ditolak SQLite saat dijalankan (fungsi
// tak dikenal, agregat di WHERE, ordinal ORDER BY di luar jangkauan, ...).
// Dulu semuanya dinarasikan sebagai "syntax_error" generik — menyalahkan
// susunan kalimat padahal masalahnya bukan di situ — dan dipajaki fokus.
// Modul murni ini memetakan pesan mentah SQLite ke kelas masalah + satu
// kalimat Piko yang akurat per kelas. Pesan mentah tidak pernah tampil.

export type SqlRuntimeErrorKind =
  | 'unknown_function'
  | 'aggregate_misuse'
  | 'ordinal_out_of_range'
  | 'datatype_mismatch'
  | 'no_such_table'
  | 'no_such_column'
  | 'incomplete_input'
  | 'syntax'
  | 'other';

export interface ClassifiedSqlError {
  kind: SqlRuntimeErrorKind;
  /** Satu-dua kalimat ramah berbahasa Indonesia untuk diucapkan Piko. */
  narration: string;
}

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err ?? '');
}

export function classifySqlRuntimeError(err: unknown): ClassifiedSqlError {
  const raw = rawMessage(err);

  const fn = /no such function:\s*([^\s(]+)/i.exec(raw);
  if (fn) {
    return {
      kind: 'unknown_function',
      narration: `Mesin data desa tidak mengenal fungsi "${fn[1]}". Fungsi yang dikenalnya antara lain COUNT, SUM, AVG, MAX, dan MIN — coba pakai salah satu dari itu, atau periksa lagi ejaan nama fungsimu.`,
    };
  }
  if (/misuse of aggregate/i.test(raw)) {
    return {
      kind: 'aggregate_misuse',
      narration:
        'Fungsi hitung seperti COUNT dan SUM tidak boleh tinggal di dalam WHERE — mesin data menghitungnya sesudah baris-baris disaring. Pindahkan saringannya ke kolom biasa, atau pakai HAVING setelah GROUP BY.',
    };
  }
  if (/out of range/i.test(raw)) {
    return {
      kind: 'ordinal_out_of_range',
      narration:
        'Nomor urut di ORDER BY-mu melampaui jumlah kolom yang kamu pilih. ORDER BY 1 berarti kolom pertama dari SELECT, ORDER BY 2 kolom kedua — hitung lagi kolom-kolommu, ya.',
    };
  }
  if (/datatype mismatch/i.test(raw)) {
    return {
      kind: 'datatype_mismatch',
      narration:
        'Ada nilai yang jenisnya tidak cocok dengan tempatnya — teks dipakai di tempat yang mengharapkan angka, misalnya. Periksa lagi nilai di LIMIT atau perbandinganmu, ya.',
    };
  }
  const tbl = /no such table:\s*(\S+)/i.exec(raw);
  if (tbl) {
    return {
      kind: 'no_such_table',
      narration: `Tabel "${tbl[1]}" tidak ada di database desa. Periksa lagi ejaan nama tabelnya — mungkin tertukar dengan tabel lain.`,
    };
  }
  const col = /no such column:\s*(\S+)/i.exec(raw);
  if (col) {
    return {
      kind: 'no_such_column',
      narration: `Kolom "${col[1]}" tidak ditemukan oleh mesin data. Periksa lagi ejaan nama kolomnya — bisa jadi ia milik tabel lain, atau belum kamu pilih.`,
    };
  }
  if (/incomplete input/i.test(raw)) {
    return {
      kind: 'incomplete_input',
      narration:
        'Query-mu berhenti di tengah kalimat — mesin data kehabisan kata sebelum perintahnya selesai. Lengkapi bagian akhirnya, misalnya nilai sesudah WHERE atau nama kolom sesudah SELECT.',
    };
  }
  if (/syntax error|near\s/i.test(raw)) {
    return {
      kind: 'syntax',
      narration:
        'Ada susunan kata yang membuat mesin data bingung membaca query-mu. Baca lagi dari kata SELECT-nya pelan-pelan — biasanya yang keliru itu tanda kurung, koma, atau ejaan kata kuncinya.',
    };
  }
  return {
    kind: 'other',
    narration:
      'Mesin data tersandung hal yang tidak terduga dan berhenti di tengah jalan. Tidak apa-apa — coba sederhanakan query-mu selangkah demi selangkah sampai ketemu bagian yang bermasalah.',
  };
}
