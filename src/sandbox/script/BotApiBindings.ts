// BotApiBindings — registry fungsi bot yang BOLEH dipanggil pemain per quest
// (docs/BLUEPRINT.md §5). StepInterpreter hanya boleh memanggil fungsi lewat
// registry ini; panggilan di luar registry menjadi FriendlyError ramah
// ("Piko belum punya modul itu"). Setiap pemanggilan tercatat di `calls`.

export type BotFunction = (...args: unknown[]) => unknown;

export interface BotCallRecord {
  /** Nama fungsi persis seperti dipanggil pemain, mis. "piko.moveForward". */
  action: string;
  args: unknown[];
}

export interface BotBindings {
  /** Implementasi fungsi, dikunci dengan nama bertitik, mis. "piko.boot". */
  functions?: Record<string, BotFunction>;
  /**
   * Objek data yang bisa dibaca pemain, mis. "sensor" -> { soilMoisture: 30 }.
   * Properti dibaca lewat MemberExpression (sensor.soilMoisture).
   */
  objects?: Record<string, Record<string, unknown>>;
}

export interface BotApiRegistry {
  /** Fungsi yang bisa dipanggil (sudah dibungkus perekam panggilan). */
  api: Record<string, BotFunction>;
  /** Nama fungsi yang diizinkan untuk quest aktif. */
  allowed: Set<string>;
  /** Objek data yang bisa dibaca (sensor, gate, ...). */
  objects: Record<string, Record<string, unknown>>;
  /** Riwayat panggilan selama registry ini hidup, urut sesuai eksekusi. */
  calls: BotCallRecord[];
}

/**
 * Buat registry Bot API.
 * @param allowed  daftar nama fungsi yang terbuka untuk quest ini.
 * @param bindings implementasi nyata (dunia game / mock). Fungsi yang
 *                 diizinkan tapi tidak punya implementasi tetap tercatat
 *                 panggilannya dan mengembalikan undefined (mode perekam).
 */
export function createBotApi(allowed: string[], bindings: BotBindings = {}): BotApiRegistry {
  const allowedSet = new Set(allowed);
  const calls: BotCallRecord[] = [];
  const api: Record<string, BotFunction> = {};
  const impls = bindings.functions ?? {};

  const register = (name: string) => {
    const impl = impls[name];
    api[name] = (...args: unknown[]) => {
      calls.push({ action: name, args: [...args] });
      return impl ? impl(...args) : undefined;
    };
  };

  for (const name of allowedSet) register(name);
  // Implementasi tambahan di luar daftar allowed TIDAK ikut terdaftar:
  // registry adalah satu-satunya gerbang (blueprint §3, aturan sandbox).

  return {
    api,
    allowed: allowedSet,
    objects: { ...(bindings.objects ?? {}) },
    calls,
  };
}

/**
 * Bot tiruan untuk pengujian & pengembangan tanpa dunia Phaser.
 * Menjaga state grid sederhana: posisi (x, y), status boot/charge,
 * pintu air (gate) yang bisa dibuka/ditutup, dan sensor kelembapan tanah.
 */
export class MockBot {
  position = { x: 0, y: 0 };
  booted = false;
  chargeLevel = 0;
  gate = { isOpen: false };
  sensor = { soilMoisture: 30 };

  readonly registry: BotApiRegistry;

  constructor(options: { soilMoisture?: number } = {}) {
    if (options.soilMoisture !== undefined) this.sensor.soilMoisture = options.soilMoisture;
    this.registry = createBotApi(
      ['piko.boot', 'piko.moveForward', 'piko.charge', 'gate.open', 'gate.close'],
      {
        functions: {
          'piko.boot': () => {
            this.booted = true;
          },
          'piko.moveForward': (steps) => {
            const n = typeof steps === 'number' && Number.isFinite(steps) ? Math.trunc(steps) : 1;
            this.position.x += n;
          },
          'piko.charge': () => {
            this.chargeLevel = 100;
          },
          'gate.open': () => {
            this.gate.isOpen = true;
          },
          'gate.close': () => {
            this.gate.isOpen = false;
          },
        },
        objects: {
          sensor: this.sensor,
          gate: this.gate,
        },
      },
    );
  }

  /** Semua panggilan yang sudah dilakukan pemain, urut eksekusi. */
  get calls(): BotCallRecord[] {
    return this.registry.calls;
  }
}
