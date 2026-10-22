// Bit-Terra UI layer (React DOM) — barrel export.
// Dunia game (Phaser, Fase 2) TIDAK pernah mengimpor dari sini; komunikasi
// UI ↔ dunia hanya lewat core/bridge (eventBus + useGameStore).

export { PixelButton, type PixelButtonProps, type PixelButtonVariant } from './design-system/PixelButton';
export { NineSlicePanel, type NineSlicePanelProps, type NineSliceVariant } from './design-system/NineSlicePanel';
export { CRTScanlineOverlay, type CRTScanlineOverlayProps } from './design-system/CRTScanlineOverlay';

export { FocusBar, type FocusBarProps } from './hud/FocusBar';
export { CartridgeBar, type CartridgeBarProps } from './hud/CartridgeBar';
export {
  CARTRIDGE_SNIPPETS,
  CARTRIDGE_COLORS,
  getCartridgeSnippet,
} from './hud/cartridgeSnippets';
export { DialogueBox, type DialogueBoxProps } from './hud/DialogueBox';

export { PikoMascotWidget, type PikoMascotWidgetProps } from './visualizer/PikoMascotWidget';
export {
  SqlTableVisualizer,
  type SqlTableVisualizerProps,
  rowKey,
  rowInSet,
} from './visualizer/SqlTableVisualizer';
export {
  BotGridStage,
  type BotGridStageProps,
  type BotPose,
  type Facing,
  type BotActionKind,
  normalizeBotAction,
} from './visualizer/BotGridStage';

export { CyberDeckFrame, type CyberDeckFrameProps, type LampState, type DeckSticker } from './cyberdeck/CyberDeckFrame';
export { RunLever, type RunLeverProps } from './cyberdeck/RunLever';
export {
  InteractiveEditor,
  type InteractiveEditorProps,
  type EditorMode,
} from './cyberdeck/InteractiveEditor';
export {
  TypingParticleCanvas,
  type TypingParticleCanvasHandle,
} from './cyberdeck/TypingParticleCanvas';
export { CyberDeckScreen, type CyberDeckScreenProps, npcDisplayName } from './cyberdeck/CyberDeckScreen';
