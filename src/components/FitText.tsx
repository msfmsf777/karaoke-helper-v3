import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface FitState {
  fontSize?: number;
  truncated: boolean;
}

export interface FitTextProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children' | 'title'> {
  text: string;
  title?: string;
  ariaLabel?: string;
  baseFontSize?: number;
  minFontSize?: number;
  style?: React.CSSProperties;
}

const MEASURE_TOLERANCE = 0.5;
const DEFAULT_MIN_FONT_SIZE = 10;
const BINARY_SEARCH_STEPS = 8;

const parseFontSize = (value: React.CSSProperties['fontSize']): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.endsWith('px')) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const FitText: React.FC<FitTextProps> = ({
  text,
  title,
  ariaLabel,
  baseFontSize,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
  className,
  style,
  ...spanProps
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);
  const [fit, setFit] = useState<FitState>({ truncated: false });

  const measure = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = spanRef.current;
      if (!element) return;

      const availableWidth = element.clientWidth;
      if (availableWidth <= 0) return;

      const computed = window.getComputedStyle(element);
      const resolvedBase = baseFontSize
        ?? parseFontSize(style?.fontSize)
        ?? Number.parseFloat(computed.fontSize)
        ?? 13;
      const resolvedMin = Math.min(resolvedBase, minFontSize);
      const previousFontSize = element.style.fontSize;

      element.style.fontSize = `${resolvedBase}px`;
      const fitsAtBase = element.scrollWidth <= availableWidth + MEASURE_TOLERANCE;

      let next: FitState;
      if (fitsAtBase) {
        next = { fontSize: resolvedBase, truncated: false };
      } else {
        element.style.fontSize = `${resolvedMin}px`;
        const fitsAtMin = element.scrollWidth <= availableWidth + MEASURE_TOLERANCE;

        if (fitsAtMin) {
          let low = resolvedMin;
          let high = resolvedBase;

          for (let i = 0; i < BINARY_SEARCH_STEPS; i += 1) {
            const mid = (low + high) / 2;
            element.style.fontSize = `${mid}px`;

            if (element.scrollWidth <= availableWidth + MEASURE_TOLERANCE) {
              low = mid;
            } else {
              high = mid;
            }
          }

          next = { fontSize: Math.floor(low * 10) / 10, truncated: false };
        } else {
          next = { fontSize: resolvedBase, truncated: true };
        }
      }

      element.style.fontSize = previousFontSize;
      setFit((current) => (
        current.truncated === next.truncated
        && Math.abs((current.fontSize ?? 0) - (next.fontSize ?? 0)) < 0.1
          ? current
          : next
      ));
    });
  }, [baseFontSize, minFontSize, style?.fontSize]);

  useLayoutEffect(() => {
    measure();
  }, [measure, text]);

  useEffect(() => {
    const element = spanRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [measure]);

  return (
    <span
      {...spanProps}
      ref={spanRef}
      className={className}
      title={title ?? text}
      aria-label={ariaLabel ?? text}
      data-i18n-fit="true"
      style={{
        ...style,
        display: style?.display ?? 'block',
        width: style?.width ?? '100%',
        minWidth: style?.minWidth ?? 0,
        maxWidth: style?.maxWidth ?? '100%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: fit.truncated ? 'ellipsis' : 'clip',
        fontSize: fit.fontSize !== undefined ? `${fit.fontSize}px` : style?.fontSize,
      }}
    >
      {text}
    </span>
  );
};

export default FitText;
