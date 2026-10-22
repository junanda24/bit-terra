export interface CRTScanlineOverlayProps {
  /** Overall strength of the scanline darkening (0–1). */
  opacity?: number;
  /** Very subtle brightness breathing, like an old phosphor screen warming up. */
  flicker?: boolean;
}

/**
 * CRT glass over a screen area: horizontal scanlines + soft vignette.
 * Pure CSS gradients, pointer-events-none so it never blocks the editor.
 */
export function CRTScanlineOverlay({ opacity = 0.55, flicker = false }: CRTScanlineOverlayProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          opacity,
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'multiply',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.38) 100%)',
        }}
      />
      {flicker ? (
        <>
          <style>{`@keyframes bt-crt-flicker { 0%,100% { opacity: 0.03; } 48% { opacity: 0.05; } 50% { opacity: 0.015; } 52% { opacity: 0.05; } }`}</style>
          <div
            className="absolute inset-0 bg-white"
            style={{ animation: 'bt-crt-flicker 4.2s linear infinite', opacity: 0.03 }}
          />
        </>
      ) : null}
    </div>
  );
}

export default CRTScanlineOverlay;
