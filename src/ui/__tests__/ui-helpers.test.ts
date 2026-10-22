import { describe, expect, it } from 'vitest';
import { getCartridgeSnippet } from '../hud/cartridgeSnippets';
import { normalizeBotAction } from '../visualizer/BotGridStage';
import { rowInSet, rowKey } from '../visualizer/SqlTableVisualizer';

describe('getCartridgeSnippet', () => {
  it('memberi kerangka untuk cartridge SQL Q2', () => {
    expect(getCartridgeSnippet('SELECT')).toBe('SELECT ');
    expect(getCartridgeSnippet('FROM')).toBe('FROM ');
    expect(getCartridgeSnippet('WHERE')).toBe('WHERE ');
  });

  it('memberi kerangka untuk cartridge bot Q1 (gaya tanda kurung)', () => {
    expect(getCartridgeSnippet('boot()')).toBe('piko.boot();');
    expect(getCartridgeSnippet('moveForward()')).toBe('piko.moveForward(1);');
    expect(getCartridgeSnippet('charge()')).toBe('piko.charge();');
  });

  it('fallback aman untuk cartridge tak dikenal', () => {
    expect(getCartridgeSnippet('TERBANG')).toBe('TERBANG ');
  });
});

describe('normalizeBotAction', () => {
  it('memetakan nama bertitik ke jenis aksi', () => {
    expect(normalizeBotAction('piko.moveForward')).toBe('move');
    expect(normalizeBotAction('piko.turnLeft')).toBe('turn-left');
    expect(normalizeBotAction('piko.turnRight')).toBe('turn-right');
    expect(normalizeBotAction('piko.boot')).toBe('boot');
    expect(normalizeBotAction('piko.charge')).toBe('charge');
    expect(normalizeBotAction('gate.open')).toBe('open');
    expect(normalizeBotAction('gate.close')).toBe('close');
  });

  it('aksi asing dianggap unknown, bukan crash', () => {
    expect(normalizeBotAction('piko.fly')).toBe('unknown');
    expect(normalizeBotAction('')).toBe('unknown');
  });
});

describe('rowKey / rowInSet (Data Scanner matching)', () => {
  it('kunci stabil walau urutan kolom berbeda', () => {
    const a = { sheep_name: 'Kriting', last_zone: 'Tepi Sungai' };
    const b = { last_zone: 'Tepi Sungai', sheep_name: 'Kriting' };
    expect(rowKey(a)).toBe(rowKey(b));
  });

  it('membedakan baris yang nilainya beda', () => {
    const a = { sheep_name: 'Kriting', last_zone: 'Tepi Sungai' };
    const b = { sheep_name: 'Bolang', last_zone: 'Tepi Sungai' };
    expect(rowKey(a)).not.toBe(rowKey(b));
  });

  it('rowInSet menemukan baris yang cocok dengan hasil query', () => {
    const result = [
      { sheep_name: 'Kriting', last_zone: 'Tepi Sungai' },
      { sheep_name: 'Bolang', last_zone: 'Dekat Bendungan' },
    ];
    const keys = new Set(result.map(rowKey));
    expect(rowInSet({ sheep_name: 'Kriting', last_zone: 'Tepi Sungai' }, keys)).toBe(true);
    expect(rowInSet({ sheep_name: 'Gembul', last_zone: 'Kandang' }, keys)).toBe(false);
  });
});
