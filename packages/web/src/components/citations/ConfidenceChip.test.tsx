import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConfidenceChip, CHIP_PALETTE } from './ConfidenceChip';

describe('ConfidenceChip', () => {
  it('renders "From your statement" for user_entered', () => {
    const { getByText } = render(
      <ConfidenceChip mode="user_entered" confidence="high" amount={16000} />
    );
    expect(getByText('From your statement')).toBeDefined();
  });

  it('renders "Estimated" for estimated', () => {
    const { getByText } = render(
      <ConfidenceChip mode="estimated" confidence="medium" amount={16000} />
    );
    expect(getByText('Estimated')).toBeDefined();
  });

  it('renders "Defaulted" when mode=defaulted and amount > 0', () => {
    const { getByText } = render(<ConfidenceChip mode="defaulted" confidence="low" amount={1} />);
    expect(getByText('Defaulted')).toBeDefined();
  });

  it('renders null when mode=defaulted and amount=0', () => {
    const { container } = render(<ConfidenceChip mode="defaulted" confidence="low" amount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when mode=defaulted and amount undefined', () => {
    const { container } = render(<ConfidenceChip mode="defaulted" confidence="low" />);
    expect(container.firstChild).toBeNull();
  });

  it('has aria-label with mode + confidence', () => {
    const { getByRole } = render(
      <ConfidenceChip mode="user_entered" confidence="high" amount={16000} />
    );
    expect(getByRole('status').getAttribute('aria-label')).toBe(
      'From your statement — high confidence'
    );
  });
});

// WCAG 2.1 helpers (pure math, no DOM). Inlined to keep the test
// self-contained and free of cross-file coupling.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number): number => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function linearize(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(L1: number, L2: number): number {
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

const BODY_BG_HSL = { h: 216, s: 33, l: 97 }; // --ds-background per globals.css

describe('ConfidenceChip WCAG AA contrast', () => {
  const L_body = relativeLuminance(...hslToRgb(BODY_BG_HSL.h, BODY_BG_HSL.s, BODY_BG_HSL.l));
  const L_chipBg = relativeLuminance(
    ...hslToRgb(CHIP_PALETTE.chipBgHsl.h, CHIP_PALETTE.chipBgHsl.s, CHIP_PALETTE.chipBgHsl.l)
  );
  const L_chipText = relativeLuminance(
    ...hslToRgb(CHIP_PALETTE.chipTextHsl.h, CHIP_PALETTE.chipTextHsl.s, CHIP_PALETTE.chipTextHsl.l)
  );
  const L_dotUE = relativeLuminance(
    ...hslToRgb(
      CHIP_PALETTE.dotUserEnteredHsl.h,
      CHIP_PALETTE.dotUserEnteredHsl.s,
      CHIP_PALETTE.dotUserEnteredHsl.l
    )
  );
  const L_dotEst = relativeLuminance(
    ...hslToRgb(
      CHIP_PALETTE.dotEstimatedHsl.h,
      CHIP_PALETTE.dotEstimatedHsl.s,
      CHIP_PALETTE.dotEstimatedHsl.l
    )
  );
  const L_border = relativeLuminance(
    ...hslToRgb(CHIP_PALETTE.borderHsl.h, CHIP_PALETTE.borderHsl.s, CHIP_PALETTE.borderHsl.l)
  );

  it('chip text on chip bg passes WCAG AA 4.5:1', () => {
    expect(contrastRatio(L_chipText, L_chipBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('chip text on body bg passes WCAG AA 4.5:1 (defensive)', () => {
    expect(contrastRatio(L_chipText, L_body)).toBeGreaterThanOrEqual(4.5);
  });

  it('user_entered dot on chip bg passes WCAG 1.4.11 non-text 3:1', () => {
    expect(contrastRatio(L_dotUE, L_chipBg)).toBeGreaterThanOrEqual(3.0);
  });

  it('estimated dot on chip bg passes WCAG 1.4.11 non-text 3:1', () => {
    expect(contrastRatio(L_dotEst, L_chipBg)).toBeGreaterThanOrEqual(3.0);
  });

  it('chip border vs body bg has perceptible edge (≥1.4:1)', () => {
    expect(contrastRatio(L_border, L_body)).toBeGreaterThanOrEqual(1.4);
  });
});

describe('ConfidenceChip dot indicator', () => {
  it('renders an emerald dot for user_entered', () => {
    const { getByTestId } = render(
      <ConfidenceChip mode="user_entered" confidence="high" amount={16000} />
    );
    const dot = getByTestId('chip-dot-user_entered');
    expect(dot.className).toMatch(/bg-emerald-700/);
  });

  it('renders an amber dot for estimated', () => {
    const { getByTestId } = render(
      <ConfidenceChip mode="estimated" confidence="medium" amount={16000} />
    );
    const dot = getByTestId('chip-dot-estimated');
    expect(dot.className).toMatch(/bg-amber-700/);
  });

  it('renders no dot for defaulted variant', () => {
    const { queryByTestId } = render(
      <ConfidenceChip mode="defaulted" confidence="low" amount={1} />
    );
    expect(queryByTestId('chip-dot-user_entered')).toBeNull();
    expect(queryByTestId('chip-dot-estimated')).toBeNull();
  });
});
