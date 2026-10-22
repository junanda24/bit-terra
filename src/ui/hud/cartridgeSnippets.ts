/**
 * Kerangka sintaks yang disisipkan saat cartridge diklik (BLUEPRINT §6:
 * cartridge = item sintaks; klik = snap-in ke editor). Murni data — tidak ada
 * logika quest di sini; cartridge yang tersedia selalu datang dari
 * quest.unlockedCartridges.
 */
export const CARTRIDGE_SNIPPETS: Record<string, string> = {
  // — SQL —
  SELECT: 'SELECT ',
  FROM: 'FROM ',
  WHERE: 'WHERE ',
  'ORDER BY': 'ORDER BY ',
  'GROUP BY': 'GROUP BY ',
  HAVING: 'HAVING ',
  JOIN: 'JOIN ',
  'INNER JOIN': 'INNER JOIN ',
  'LEFT JOIN': 'LEFT JOIN ',
  ON: 'ON ',
  LIMIT: 'LIMIT ',
  UPDATE: 'UPDATE ',
  SET: 'SET ',
  'INSERT INTO': 'INSERT INTO ',
  VALUES: 'VALUES ',
  COMMIT: 'COMMIT;',
  ROLLBACK: 'ROLLBACK;',
  // — Bot script (nama cartridge di konten quest berbentuk 'boot()') —
  'boot()': 'piko.boot();',
  boot: 'piko.boot();',
  'piko.boot': 'piko.boot();',
  'moveForward()': 'piko.moveForward(1);',
  moveForward: 'piko.moveForward(1);',
  'piko.moveForward': 'piko.moveForward(1);',
  'turnLeft()': 'piko.turnLeft();',
  'piko.turnLeft': 'piko.turnLeft();',
  'turnRight()': 'piko.turnRight();',
  'piko.turnRight': 'piko.turnRight();',
  'charge()': 'piko.charge();',
  charge: 'piko.charge();',
  'piko.charge': 'piko.charge();',
  'open()': 'gate.open();',
  'gate.open': 'gate.open();',
  'close()': 'gate.close();',
  'gate.close': 'gate.close();',
  if: 'if ( ) {\n  \n}',
  else: 'else {\n  \n}',
  for: 'for (let i = 0; i < 3; i++) {\n  \n}',
  while: 'while ( ) {\n  \n}',
  function: 'function namaFungsi() {\n  \n}',
};

export function getCartridgeSnippet(name: string): string {
  return CARTRIDGE_SNIPPETS[name] ?? `${name} `;
}

/** Warna bodi cartridge, bergiliran dari palet hangat + terminal (§4). */
export const CARTRIDGE_COLORS: { face: string; text: string }[] = [
  { face: '#f4b41b', text: '#141820' }, // sun
  { face: '#00f5d4', text: '#0b2b25' }, // mint
  { face: '#c87d55', text: '#141820' }, // copper — teks tinta 4.87:1 (audit kontras: krem hanya 3.03:1)
  { face: '#3b82a6', text: '#0a0e14' }, // river — teks nyaris-hitam ±4.6:1 (teks terang apa pun mentok 4.2:1 di wajah ini)
  { face: '#4b724f', text: '#eef7e6' }, // moss
];
