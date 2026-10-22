/**
 * Palet warna dunia Bit-Terra (docs/BLUEPRINT.md §4 — "Tactile Solarpunk").
 * Dipakai textures.ts (lukis prosedural), VillageScene, dan WorldScreen
 * supaya dunia canvas dan HUD DOM berbicara bahasa warna yang sama.
 */
export const WORLD_PALETTE = {
  moss: '#4b724f',
  mossDark: '#3a5a3e',
  mossLight: '#63915f',
  sun: '#f4b41b',
  wood: '#a85432',
  woodDark: '#7c3a20',
  woodLight: '#c87d55',
  river: '#3b82a6',
  riverDark: '#2c637f',
  riverLight: '#63a8c6',
  copper: '#c87d55',
  slate: '#141820',
  bezel: '#d8ccb8',
  amber: '#ffb000',
  mint: '#00f5d4',
  coral: '#ff4d6d',
  soil: '#6e4a2f',
  soilDark: '#573a24',
  stone: '#9a917e',
  stoneDark: '#7a7261',
  cream: '#f2ead6',
} as const;

/** Konversi '#rrggbb' -> angka Phaser. */
export function hexNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}
