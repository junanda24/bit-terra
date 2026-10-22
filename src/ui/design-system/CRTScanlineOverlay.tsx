export interface CRTScanlineOverlayProps {
  /** Overall strength of the scanline layer (0–1). */
  opacity?: number;
  /** Very subtle brightness breathing, like an old phosphor screen warming up. */
  flicker?: boolean;
}

/**
 * Kaca CRT di atas area layar Cyber-Deck (Fase 4): garis pindai halus +
 * vignette lembut + kilau kaca sangat tipis dari kiri atas. Semua lapisan
 * pointer-events-none dan STATIS — tidak ada animasi kecuali `flicker`
 * diminta eksplisit, dan itupun mati total di prefers-reduced-motion.
 *
 * Angka yang dipilih (agar keterbacaan kode tidak dikorbankan):
 * - scanline: garis 1px rgba(0,0,0,0.16) per periode 3px, layer di-opacity
 *   `opacity` (bingkai memakai 0.5) → peredupan puncak per garis 8%,
 *   rata-rata permukaan ~2.7%. Lapisan ini blend multiply: hanya
 *   menggelapkan, tidak pernah mengangkat hitam jadi abu.
 * - vignette: transparan sampai 58% radius, maksimal rgba(0,0,0,0.30) di
 *   sudut ekstrem — area tengah (tempat mata membaca) tidak tersentuh.
 * - kilau: gradasi putih maksimal 0.055 di sudut kiri atas, hilang di 45%.
 *
 * Permukaan editor sendiri dilindungi dua lapis: aturan CSS di index.css
 * mengangkat .cm-editor ke z-index 30 (di atas kaca z-20 ini) sebisa
 * stacking context mengizinkan; dan bila tumpukan itu tertahan konteks
 * transform leluhur, angka peredupan di atas adalah jaring pengamannya —
 * penurunan rasio kontras teks terang-di-gelap terburuk < 3%.
 */
export function CRTScanlineOverlay({ opacity = 0.5, flicker = false }: CRTScanlineOverlayProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          opacity,
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'multiply',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.30) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,240,0.055) 0%, rgba(255,255,240,0.015) 26%, transparent 45%)',
        }}
      />
      {flicker ? (
        <>
          <style>{`
            @keyframes bt-crt-flicker { 0%,100% { opacity: 0.03; } 48% { opacity: 0.05; } 50% { opacity: 0.015; } 52% { opacity: 0.05; } }
            @media (prefers-reduced-motion: reduce) {
              .bt-crt-flicker { animation: none !important; opacity: 0 !important; }
            }
          `}</style>
          <div
            className="bt-crt-flicker absolute inset-0 bg-white"
            style={{ animation: 'bt-crt-flicker 4.2s linear infinite', opacity: 0.03 }}
          />
        </>
      ) : null}
    </div>
  );
}

export default CRTScanlineOverlay;
