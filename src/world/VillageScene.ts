/**
 * VillageScene — Desa Bit-Terra yang bisa dijelajahi (Fase 2, Phaser 3 API
 * dari phaser 4.2.1; API diverifikasi dari types paket terpasang).
 *
 * Tanggung jawab scene ini HANYA dunia: peta, pemain, NPC, Piko, domba,
 * dan deteksi interaksi. Keputusan "interaksi ini membuka quest/dialog apa"
 * ada di createWorld (jembatan) — scene melaporkan lewat hooks.
 *
 * Catatan engineering (gameplay-engineer): tidak ada alokasi per-frame di
 * update() selain aritmetika vektor bawaan; pemindaian prompt memakai
 * daftar interactable statis (14 titik); collider statis digabung per
 * rentang baris agar jumlah badan fisika kecil.
 */
import Phaser from 'phaser';
import { eventBus } from '../core/bridge/eventBus';
import {
  GROUND_TEXTURE,
  INTERACTABLES,
  MAP_COLS,
  MAP_OBJECTS,
  MAP_ROWS,
  NPCS,
  PIKO_CORNER,
  PLAYER_SPAWN,
  SHEEP,
  WORLD_H,
  WORLD_W,
  buildWalkGrid,
  groundAt,
  TILE_SIZE,
  tileToWorld,
  type Interactable,
  type MapObject,
} from './mapData';
import { generateWorldTextures } from './textures';
import { BLANK_TEXTURE, CHARACTER_SPECS, PIKO_TEXTURE, SHEEP_TEXTURE } from './textureSpec';
import { currentPauseCount, worldBridge, type WorldSceneHandle } from './bridgeState';
import {
  deriveWorldState,
  newlyRepairedAreas,
  sheepTile,
  type WorldState,
} from './worldState';

const PLAYER_SPEED = 152;
const PIKO_SPEED = 168;
const INTERACT_RADIUS_TILES = 1.7;
const DEPTH_BASE = 500;

type Facing = 'down' | 'up' | 'side';

interface NpcActor {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  homeX: number;
  homeY: number;
  wanderRadius: number;
  charKey: string;
}

export class VillageScene extends Phaser.Scene implements WorldSceneHandle {
  private state: WorldState = deriveWorldState([]);
  private walkGrid: boolean[][] = buildWalkGrid(false);

  private player!: Phaser.Physics.Arcade.Sprite;
  private piko!: Phaser.Physics.Arcade.Sprite;
  private pikoZzz: Phaser.GameObjects.Text | null = null;
  private pikoScaleTween: Phaser.Tweens.Tween | null = null;

  private colliders!: Phaser.Physics.Arcade.StaticGroup;
  private lampImage: Phaser.GameObjects.Image | null = null;
  private lampGlow: Phaser.GameObjects.Arc | null = null;
  private gateImage: Phaser.GameObjects.Image | null = null;
  private canopyImage: Phaser.GameObjects.Image | null = null;
  private canopyGlow: Phaser.GameObjects.Arc | null = null;
  private sluiceImage: Phaser.GameObjects.Image | null = null;
  private shedImage: Phaser.GameObjects.Image | null = null;
  private archImage: Phaser.GameObjects.Image | null = null;
  private sluiceFlowStrip: Phaser.GameObjects.Rectangle | null = null;
  private farmGlow: Phaser.GameObjects.Rectangle | null = null;

  private npcs: NpcActor[] = [];
  private sheepSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private sheepLabels = new Map<string, Phaser.GameObjects.Text>();

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasd: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  private keyE: Phaser.Input.Keyboard.Key | null = null;

  private facing: Facing = 'down';
  private nearest: Interactable | null = null;
  private promptMarker: Phaser.GameObjects.Text | null = null;
  private lastPromptText: string | null = null;

  constructor() {
    super('village');
  }

  // ------------------------------------------------------------ lifecycle

  create(): void {
    generateWorldTextures(this);
    this.state = deriveWorldState(worldBridge.completedQuests);
    this.walkGrid = buildWalkGrid(this.state.penGateClosed);

    this.paintGround();
    this.buildColliders();
    this.placeObjects();
    this.createAnimations();
    this.placeSheep();
    this.placeNpcs();
    this.placePiko();
    this.placePlayer();

    this.promptMarker = this.add
      .text(0, 0, '!', {
        fontFamily: '"Pixelify Sans", sans-serif',
        fontSize: '15px',
        color: '#ffb000',
        backgroundColor: '#141820',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(6000)
      .setVisible(false);
    // Marker melayang via sin() di scanNearest (bukan tween — posisinya
    // ditulis ulang tiap frame mengikuti titik interaksi terdekat).

    const kb = this.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.wasd = kb.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
      this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.nearest) return;
      const dx = pointer.worldX - tileToWorld(this.nearest.tileX);
      const dy = pointer.worldY - tileToWorld(this.nearest.tileY);
      if (Math.hypot(dx, dy) <= TILE_SIZE * 2.1) this.activate(this.nearest);
    });

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor('#1d2b1a');
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    worldBridge.scene = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (worldBridge.scene === this) worldBridge.scene = null;
    });
    // Deck/dialog bisa sudah meminta pause sebelum scene lahir — terapkan
    // begitu create selesai (event CREATE), bukan di tengah create.
    this.events.once(Phaser.Scenes.Events.CREATE, () => {
      if (currentPauseCount() > 0) this.sys.pause();
    });
  }

  // ------------------------------------------------------------ painting

  private paintGround(): void {
    const key = 'world_ground';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, WORLD_W, WORLD_H);
      if (tex) {
        const ctx = tex.getContext();
        for (let y = 0; y < MAP_ROWS; y++) {
          for (let x = 0; x < MAP_COLS; x++) {
            const g = groundAt(x, y);
            if (!g) continue;
            const src = this.textures.get(GROUND_TEXTURE[g]).getSourceImage();
            ctx.drawImage(src as CanvasImageSource, x * TILE_SIZE, y * TILE_SIZE);
          }
        }
        tex.refresh();
      }
    }
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
  }

  private buildColliders(): void {
    this.colliders = this.physics.add.staticGroup();
    this.fillColliders();
  }

  /** Isi grup collider dari walkGrid semasa: ubin padat digabung per rentang baris. */
  private fillColliders(): void {
    const addRun = (cx: number, cy: number, w: number, h: number) => {
      const s = this.colliders.create(cx, cy, BLANK_TEXTURE) as Phaser.Physics.Arcade.Sprite;
      s.setDisplaySize(w, h);
      s.setAlpha(0);
      s.refreshBody();
    };
    for (let y = 0; y < MAP_ROWS; y++) {
      let runStart = -1;
      for (let x = 0; x <= MAP_COLS; x++) {
        const solid = x < MAP_COLS && !this.walkGrid[y][x];
        if (solid && runStart < 0) runStart = x;
        if (!solid && runStart >= 0) {
          const w = (x - runStart) * TILE_SIZE;
          addRun(runStart * TILE_SIZE + w / 2, y * TILE_SIZE + TILE_SIZE / 2, w, TILE_SIZE);
          runStart = -1;
        }
      }
    }
  }

  private rebuildColliders(): void {
    // Collider pemain/Piko terdaftar terhadap GRUP ini, bukan anaknya —
    // mengosongkan + mengisi ulang grup tidak membatalkan collider itu.
    this.colliders.clear(true, true);
    this.walkGrid = buildWalkGrid(this.state.penGateClosed);
    this.fillColliders();
  }

  private objectDepth(o: MapObject): number {
    if (o.layer === 'above') return 5000;
    if (o.layer === 'ground') return 1;
    return (o.tileY + o.tilesH) * TILE_SIZE + DEPTH_BASE;
  }

  private placeObjects(): void {
    for (const o of MAP_OBJECTS) {
      const tex = this.textures.get(o.texture);
      const frame = tex.get();
      const img = this.add
        .image(o.tileX * TILE_SIZE, (o.tileY + o.tilesH) * TILE_SIZE - frame.height, o.texture)
        .setOrigin(0, 0)
        .setDepth(this.objectDepth(o));
      if (o.id === 'lamp_workshop') {
        this.lampImage = img;
        img.setTexture(this.state.workshopLampOn ? 'obj_lamp_on' : 'obj_lamp_off');
        this.lampGlow = this.add
          .circle(o.tileX * TILE_SIZE + 16, o.tileY * TILE_SIZE + 10, 42, 0xf4b41b, 0.13)
          .setDepth(4500)
          .setVisible(this.state.workshopLampOn);
      }
      if (o.id === 'pen_gate') {
        this.gateImage = img;
        img.setTexture(this.state.penGateClosed ? 'obj_gate_closed' : 'obj_gate_open');
      }
      if (o.id === 'sluice') {
        this.sluiceImage = img;
        img.setTexture(this.state.sluiceFlowing ? 'obj_sluice_flow' : 'obj_sluice');
      }
      if (o.id === 'conveyor_shed') {
        this.shedImage = img;
        img.setTexture(this.state.conveyorRunning ? 'obj_shed_lit' : 'obj_shed');
      }
      if (o.id === 'root_arch') {
        this.archImage = img;
        img.setTexture(this.state.mazeRootsReceded ? 'obj_root_arch_open' : 'obj_root_arch');
      }
      if (o.id === 'mother_canopy') {
        this.canopyImage = img;
        this.tweens.add({
          targets: img,
          x: '+=4',
          duration: 3400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        // Mekar Pohon Induk (Q8): cahaya hangat di plaza + rona keemasan di
        // kanopi — pola yang sama dengan lampu bengkel (Q1), digerakkan
        // murni oleh deriveWorldState.motherTreeBlooming.
        this.canopyGlow = this.add
          .circle(19.5 * TILE_SIZE, 4 * TILE_SIZE, 120, 0xf4b41b, 0.1)
          .setDepth(4400)
          .setVisible(this.state.motherTreeBlooming);
        if (this.state.motherTreeBlooming) img.setTint(0xffe2a0);
      }
    }
    // Lapisan keadaan Fase 3 (digambar sekali, visibilitasnya digerakkan
    // deriveWorldState lewat applyCompletedQuests):
    // - aliran air di bawah pintu air saat sluiceFlowing (Q3);
    // - rona hijau di atas ladang tenggara saat fieldGreen (Q3).
    this.sluiceFlowStrip = this.add
      .rectangle(12 * TILE_SIZE, 24 * TILE_SIZE, 2 * TILE_SIZE, 2 * TILE_SIZE, 0x9fd8ee, 0.35)
      .setOrigin(0, 0)
      .setDepth(2)
      .setVisible(this.state.sluiceFlowing);
    this.farmGlow = this.add
      .rectangle(27 * TILE_SIZE, 13 * TILE_SIZE, 11 * TILE_SIZE, 6 * TILE_SIZE, 0x6fae5f, 0.16)
      .setOrigin(0, 0)
      .setDepth(2)
      .setVisible(this.state.fieldGreen);
  }

  private createAnimations(): void {
    for (const spec of Object.values(CHARACTER_SPECS)) {
      for (const view of ['down', 'up', 'side'] as const) {
        const key = `${spec.key}_${view}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: [
            { key: spec.key, frame: `${view}_1` },
            { key: spec.key, frame: `${view}_2` },
          ],
          frameRate: 6,
          repeat: -1,
        });
      }
    }
  }

  // ------------------------------------------------------------ actors

  private placePlayer(): void {
    this.player = this.physics.add.sprite(
      tileToWorld(PLAYER_SPAWN.x),
      tileToWorld(PLAYER_SPAWN.y),
      CHARACTER_SPECS.player.key,
      'down_0',
    );
    this.player.setDepth(DEPTH_BASE + this.player.y);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 12);
    body.setOffset(7, 27);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.colliders);
    if (this.piko) this.physics.add.collider(this.piko, this.colliders);
  }

  private placePiko(): void {
    this.piko = this.physics.add.sprite(
      tileToWorld(PIKO_CORNER.x),
      tileToWorld(PIKO_CORNER.y),
      PIKO_TEXTURE,
      this.state.pikoAwake ? 'awake' : 'asleep',
    );
    this.piko.setDepth(DEPTH_BASE + this.piko.y);
    const body = this.piko.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 12);
    body.setOffset(6, 19);
    this.piko.setCollideWorldBounds(true);
    if (!this.state.pikoAwake) {
      body.setImmovable(true);
      this.pikoZzz = this.add
        .text(this.piko.x + 12, this.piko.y - 26, 'Z z', {
          fontFamily: '"Pixelify Sans", sans-serif',
          fontSize: '12px',
          color: '#d8ccb8',
        })
        .setDepth(6000);
      this.tweens.add({
        targets: this.pikoZzz,
        y: '-=6',
        alpha: 0.25,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.startPikoBounce();
    }
  }

  private startPikoBounce(): void {
    if (this.pikoScaleTween) return;
    this.pikoScaleTween = this.tweens.add({
      targets: this.piko,
      scaleY: 1.07,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private placeNpcs(): void {
    for (const npc of NPCS) {
      const spec = CHARACTER_SPECS[npc.character];
      const sprite = this.add.sprite(
        tileToWorld(npc.tileX),
        tileToWorld(npc.tileY),
        spec.key,
        'down_0',
      );
      sprite.setDepth(DEPTH_BASE + sprite.y);
      const label = this.add
        .text(sprite.x, sprite.y - 34, npc.name, {
          fontFamily: '"Pixelify Sans", sans-serif',
          fontSize: '11px',
          color: '#f2ead6',
          stroke: '#141820',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(6001);
      const actor: NpcActor = {
        sprite,
        label,
        homeX: npc.tileX,
        homeY: npc.tileY,
        wanderRadius: npc.wanderRadius,
        charKey: spec.key,
      };
      this.npcs.push(actor);
      if (npc.wanderRadius <= 0) {
        this.tweens.add({
          targets: sprite,
          y: '-=2',
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        this.scheduleWander(actor);
      }
    }
  }

  private scheduleWander(actor: NpcActor): void {
    this.time.delayedCall(1800 + Math.random() * 2600, () => {
      if (!this.scene.isActive()) return;
      const candidates: [number, number][] = [];
      for (let dy = -actor.wanderRadius; dy <= actor.wanderRadius; dy++) {
        for (let dx = -actor.wanderRadius; dx <= actor.wanderRadius; dx++) {
          const x = actor.homeX + dx;
          const y = actor.homeY + dy;
          if (x >= 0 && y >= 0 && x < MAP_COLS && y < MAP_ROWS && this.walkGrid[y][x]) {
            candidates.push([x, y]);
          }
        }
      }
      if (candidates.length > 0) {
        const [tx, ty] = candidates[Math.floor(Math.random() * candidates.length)];
        const wx = tileToWorld(tx);
        const wy = tileToWorld(ty);
        const dx = wx - actor.sprite.x;
        const dy = wy - actor.sprite.y;
        const face: Facing = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
        // Seni 'side' menghadap kiri; bergerak ke kanan = cerminkan.
        actor.sprite.setFlipX(face === 'side' && dx > 0);
        actor.sprite.play(`${actor.charKey}_${face}`, true);
        const dist = Math.hypot(dx, dy);
        this.tweens.add({
          targets: actor.sprite,
          x: wx,
          y: wy,
          duration: Math.max(300, dist * 9),
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            actor.sprite.setDepth(DEPTH_BASE + actor.sprite.y);
            actor.label.setPosition(actor.sprite.x, actor.sprite.y - 34);
          },
          onComplete: () => {
            actor.sprite.stop();
            actor.sprite.setFrame('down_0');
            actor.sprite.setFlipX(false);
          },
        });
      }
      this.scheduleWander(actor);
    });
  }

  private placeSheep(): void {
    for (const spot of SHEEP) {
      const pos = sheepTile(this.state, spot.name);
      if (!pos) continue;
      const sprite = this.add.sprite(tileToWorld(pos.x), tileToWorld(pos.y), SHEEP_TEXTURE);
      sprite.setFlipX(pos.flip);
      sprite.setDepth(DEPTH_BASE + sprite.y);
      this.sheepSprites.set(spot.name, sprite);
      this.tweens.add({
        targets: sprite,
        y: '-=2',
        duration: 900 + spot.name.length * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      const label = this.add
        .text(sprite.x, sprite.y - 26, spot.name, {
          fontFamily: '"Pixelify Sans", sans-serif',
          fontSize: '10px',
          color: '#f2ead6',
          stroke: '#141820',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(6001)
        .setVisible(this.state.sheepHome);
      this.sheepLabels.set(spot.name, label);
    }
  }

  // ------------------------------------------------------------ state

  applyCompletedQuests(completedQuests: readonly string[]): void {
    const prev = this.state;
    const next = deriveWorldState(completedQuests);
    this.state = next;

    for (const area of newlyRepairedAreas(prev, next)) {
      eventBus.emit('WORLD_REPAIR', { area });
    }

    if (this.lampImage) {
      this.lampImage.setTexture(next.workshopLampOn ? 'obj_lamp_on' : 'obj_lamp_off');
    }
    if (this.lampGlow) this.lampGlow.setVisible(next.workshopLampOn);

    if (prev.motherTreeBlooming !== next.motherTreeBlooming) {
      if (this.canopyGlow) this.canopyGlow.setVisible(next.motherTreeBlooming);
      if (this.canopyImage) {
        if (next.motherTreeBlooming) this.canopyImage.setTint(0xffe2a0);
        else this.canopyImage.clearTint();
      }
    }

    if (prev.sluiceFlowing !== next.sluiceFlowing) {
      if (this.sluiceImage) {
        this.sluiceImage.setTexture(next.sluiceFlowing ? 'obj_sluice_flow' : 'obj_sluice');
      }
      if (this.sluiceFlowStrip) this.sluiceFlowStrip.setVisible(next.sluiceFlowing);
    }
    if (prev.fieldGreen !== next.fieldGreen && this.farmGlow) {
      this.farmGlow.setVisible(next.fieldGreen);
    }
    if (prev.conveyorRunning !== next.conveyorRunning && this.shedImage) {
      this.shedImage.setTexture(next.conveyorRunning ? 'obj_shed_lit' : 'obj_shed');
    }
    if (prev.mazeRootsReceded !== next.mazeRootsReceded && this.archImage) {
      this.archImage.setTexture(next.mazeRootsReceded ? 'obj_root_arch_open' : 'obj_root_arch');
    }

    if (prev.penGateClosed !== next.penGateClosed) {
      if (this.gateImage) {
        this.gateImage.setTexture(next.penGateClosed ? 'obj_gate_closed' : 'obj_gate_open');
      }
      this.rebuildColliders();
    }

    if (prev.pikoAwake !== next.pikoAwake && next.pikoAwake) {
      const body = this.piko.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(false);
      this.piko.setFrame('happy');
      if (this.pikoZzz) {
        this.tweens.killTweensOf(this.pikoZzz);
        this.pikoZzz.destroy();
        this.pikoZzz = null;
      }
      this.time.delayedCall(1400, () => {
        if (this.state.pikoAwake) this.piko.setFrame('awake');
      });
      this.startPikoBounce();
    }

    if (prev.sheepHome !== next.sheepHome) {
      for (const spot of SHEEP) {
        const sprite = this.sheepSprites.get(spot.name);
        const pos = sheepTile(next, spot.name);
        if (!sprite || !pos) continue;
        sprite.setPosition(tileToWorld(pos.x), tileToWorld(pos.y));
        sprite.setFlipX(pos.flip);
        sprite.setDepth(DEPTH_BASE + sprite.y);
        const label = this.sheepLabels.get(spot.name);
        if (label) {
          label.setPosition(sprite.x, sprite.y - 26);
          label.setVisible(next.sheepHome);
        }
      }
    }
  }

  pauseWorld(): void {
    // Handle ini hanya diterbitkan di akhir create(), jadi sys selalu siap.
    if (this.sys) this.sys.pause();
  }

  resumeWorld(): void {
    if (this.sys) this.sys.resume();
  }

  // ------------------------------------------------------------ update

  private activate(target: Interactable): void {
    worldBridge.hooks.onInteract(target);
  }

  private scanNearest(): void {
    const px = this.player.x / TILE_SIZE;
    const py = this.player.y / TILE_SIZE;
    let best: Interactable | null = null;
    let bestDist = INTERACT_RADIUS_TILES;
    for (const it of INTERACTABLES) {
      const d = Math.hypot(it.tileX + 0.5 - px, it.tileY + 0.5 - py);
      if (d < bestDist) {
        bestDist = d;
        best = it;
      }
    }
    this.nearest = best;
    const text = best ? best.prompt : null;
    if (text !== this.lastPromptText) {
      this.lastPromptText = text;
      eventBus.emit('WORLD_PROMPT', { text });
    }
    if (this.promptMarker) {
      if (best) {
        const bob = Math.sin(this.time.now / 300) * 3;
        this.promptMarker.setVisible(true);
        this.promptMarker.setPosition(
          tileToWorld(best.tileX),
          tileToWorld(best.tileY) - 30 + bob,
        );
      } else {
        this.promptMarker.setVisible(false);
      }
    }
  }

  update(): void {
    if (!this.player || !this.player.body) return;

    // --- gerak pemain (keyboard + joystick sentuh bersama)
    let vx = 0;
    let vy = 0;
    if (this.cursors) {
      if (this.cursors.left.isDown) vx -= 1;
      if (this.cursors.right.isDown) vx += 1;
      if (this.cursors.up.isDown) vy -= 1;
      if (this.cursors.down.isDown) vy += 1;
    }
    if (this.wasd) {
      if (this.wasd.A.isDown) vx -= 1;
      if (this.wasd.D.isDown) vx += 1;
      if (this.wasd.W.isDown) vy -= 1;
      if (this.wasd.S.isDown) vy += 1;
    }
    const touch = worldBridge.touch;
    if (touch.x !== 0 || touch.y !== 0) {
      vx += touch.x;
      vy += touch.y;
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx = (vx / len) * PLAYER_SPEED;
      vy = (vy / len) * PLAYER_SPEED;
      const face: Facing = Math.abs(vx) > Math.abs(vy) ? 'side' : vy < 0 ? 'up' : 'down';
      this.facing = face;
      // Seni 'side' menghadap kiri; bergerak ke kanan = cerminkan.
      this.player.setFlipX(face === 'side' && vx > 0);
      this.player.play(`${CHARACTER_SPECS.player.key}_${face}`, true);
    } else {
      this.player.stop();
      const view = this.facing;
      this.player.setFrame(`${view}_0`);
    }
    this.player.setVelocity(vx, vy);
    this.player.setDepth(DEPTH_BASE + this.player.y + 8);

    // --- Piko mengikuti (setelah bangun)
    if (this.state.pikoAwake && this.piko && this.piko.body) {
      const dx = this.player.x - this.piko.x;
      const dy = this.player.y - this.piko.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 340) {
        this.piko.setPosition(this.player.x - 20, this.player.y + 10);
        this.piko.setVelocity(0, 0);
      } else if (dist > 46) {
        this.piko.setVelocity((dx / dist) * PIKO_SPEED, (dy / dist) * PIKO_SPEED);
        this.piko.setFlipX(dx < 0);
      } else {
        this.piko.setVelocity(0, 0);
      }
      this.piko.setDepth(DEPTH_BASE + this.piko.y + 8);
    }

    // --- interaksi
    this.scanNearest();
    if (this.nearest) {
      if (this.keyE && Phaser.Input.Keyboard.JustDown(this.keyE)) {
        this.activate(this.nearest);
      } else if (worldBridge.touch.interact) {
        worldBridge.touch.interact = false;
        this.activate(this.nearest);
      }
    } else if (worldBridge.touch.interact) {
      worldBridge.touch.interact = false;
    }
  }
}
