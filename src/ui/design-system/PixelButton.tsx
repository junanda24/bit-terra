import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type PixelButtonVariant = 'copper' | 'wood' | 'moss' | 'slate';

interface VariantStyle {
  face: string;
  edge: string;
  text: string;
}

// Tactile Solarpunk palette (docs/BLUEPRINT.md §4). The "edge" is the darker
// underside that makes the button feel like a physical block of material.
const VARIANTS: Record<PixelButtonVariant, VariantStyle> = {
  copper: { face: '#c87d55', edge: '#8a4f30', text: '#fff7ea' },
  wood: { face: '#a85432', edge: '#66300f', text: '#ffedd9' },
  moss: { face: '#4b724f', edge: '#2c4630', text: '#eef7e6' },
  slate: { face: '#26303f', edge: '#0b0e14', text: '#ffb000' },
};

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PixelButtonVariant;
  children: ReactNode;
}

/**
 * Physical-feeling pixel button: thick bottom edge, presses down on click
 * (translate + edge shrinks), chunky corners. No soft web gradients.
 */
export function PixelButton({
  variant = 'copper',
  children,
  className = '',
  style,
  disabled,
  ...rest
}: PixelButtonProps) {
  const v = VARIANTS[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-[4px] px-4 py-2 text-[15px] font-semibold tracking-wide transition-transform duration-75 active:translate-y-[3px] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0 ${className}`}
      style={{
        fontFamily: "'Pixelify Sans', sans-serif",
        backgroundColor: v.face,
        color: v.text,
        border: `2px solid ${v.edge}`,
        boxShadow: `0 4px 0 ${v.edge}, inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.18)`,
        textShadow: '0 1px 0 rgba(0,0,0,0.35)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export default PixelButton;
