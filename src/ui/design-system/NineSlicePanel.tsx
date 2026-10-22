import type { CSSProperties, ReactNode } from 'react';

export type NineSliceVariant = 'copper' | 'wood' | 'slate';

const FRAME: Record<NineSliceVariant, { border: string; mid: string; face: string }> = {
  copper: { border: '#8a4f30', mid: '#c87d55', face: '#1a1410' },
  wood: { border: '#66300f', mid: '#a85432', face: '#171310' },
  slate: { border: '#05070a', mid: '#26303f', face: '#141820' },
};

/** A single corner screw: brushed-metal disc with a cross slot, pure CSS. */
function Bolt({ position }: { position: CSSProperties }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute h-[11px] w-[11px] rounded-full"
      style={{
        ...position,
        background:
          'radial-gradient(circle at 35% 30%, #f4ead2 0%, #b8ab90 45%, #6f6450 100%)',
        boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.6), 0 1px 1px rgba(0,0,0,0.5)',
      }}
    >
      <span
        className="absolute left-1/2 top-1/2 block h-[1.5px] w-[7px] -translate-x-1/2 -translate-y-1/2 bg-[#4a4234]"
        style={{ transform: 'translate(-50%,-50%) rotate(38deg)' }}
      />
    </span>
  );
}

export interface NineSlicePanelProps {
  variant?: NineSliceVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Background of the inner well; defaults to the variant face colour. */
  wellColor?: string;
}

/**
 * 9-slice style panel without image assets: layered borders + hard inset
 * shadows read as a riveted copper/wood/slate frame, bolts in all 4 corners.
 */
export function NineSlicePanel({
  variant = 'slate',
  title,
  children,
  className = '',
  style,
  wellColor,
}: NineSlicePanelProps) {
  const f = FRAME[variant];
  return (
    <div
      className={`relative ${className}`}
      style={{
        backgroundColor: f.mid,
        border: `3px solid ${f.border}`,
        borderRadius: 6,
        boxShadow:
          'inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -3px 0 rgba(0,0,0,0.35), 0 4px 0 rgba(0,0,0,0.35)',
        padding: 7,
        ...style,
      }}
    >
      <Bolt position={{ top: 3, left: 3 }} />
      <Bolt position={{ top: 3, right: 3 }} />
      <Bolt position={{ bottom: 3, left: 3 }} />
      <Bolt position={{ bottom: 3, right: 3 }} />
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          backgroundColor: wellColor ?? f.face,
          border: '2px solid rgba(0,0,0,0.55)',
          borderRadius: 3,
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.55)',
        }}
      >
        {title ? (
          <div
            className="border-b-2 border-black/50 px-3 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em]"
            style={{ fontFamily: "'Pixelify Sans', sans-serif", color: '#f4b41b' }}
          >
            {title}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export default NineSlicePanel;
