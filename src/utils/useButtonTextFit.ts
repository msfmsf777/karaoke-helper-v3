import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const TOLERANCE_PX = 1;
const MIN_READABLE_FONT_PX = 10.5;
const SHRINK_RATIO = 0.84;
const SEARCH_STEPS = 5;

function isEligibleButton(button: HTMLButtonElement): boolean {
  if (button.dataset.noAutofit === 'true') return false;
  const text = (button.textContent ?? '').trim();
  if (text.length < 2) return false;
  if (button.querySelector('[data-i18n-fit="true"]')) return false;
  if (button.querySelector('div, p')) return false;

  const computed = window.getComputedStyle(button);
  if (computed.display === 'none' || computed.visibility === 'hidden') return false;
  if (computed.flexDirection === 'column') return false;

  return true;
}

function doesParentRowOverflow(button: HTMLButtonElement): boolean {
  const parent = button.parentElement;
  if (!parent || parent.clientWidth <= 0) return false;
  const parentComputed = window.getComputedStyle(parent);
  if (!parentComputed.display.includes('flex')) return false;
  if (!parentComputed.flexDirection.startsWith('row')) return false;
  if (parentComputed.overflowX === 'auto' || parentComputed.overflowX === 'scroll') return false;
  return parent.scrollWidth > parent.clientWidth + 2;
}

function fitSingleButton(button: HTMLButtonElement): void {
  if (!isEligibleButton(button)) return;
  if (button.clientWidth <= 0 && button.offsetParent === null) return;

  const computed = window.getComputedStyle(button);
  let baseFontSize = Number.parseFloat(button.dataset.baseFontSize ?? '');
  if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) {
    baseFontSize = Number.parseFloat(computed.fontSize) || 13;
    button.dataset.baseFontSize = String(baseFontSize);
  }

  // Step 1: Test single-line at baseFontSize while preventing accidental flex squeeze
  button.style.whiteSpace = 'nowrap';
  button.style.flexShrink = '0';
  button.style.fontSize = `${baseFontSize}px`;
  button.style.textOverflow = '';

  const fitsButtonAtBase = button.scrollWidth <= button.clientWidth + TOLERANCE_PX;
  const parentOverflowsAtBase = doesParentRowOverflow(button);

  if (fitsButtonAtBase && !parentOverflowsAtBase) {
    return;
  }

  // Step 2: Allow flex shrink within row if needed and try bounded font-size reduction
  if (parentOverflowsAtBase) {
    button.style.flexShrink = '1';
    if (!button.style.minWidth) {
      button.style.minWidth = '0px';
    }
  }

  const minFontSize = Math.min(
    baseFontSize,
    Math.max(MIN_READABLE_FONT_PX, Math.round(baseFontSize * SHRINK_RATIO * 2) / 2),
  );

  button.style.fontSize = `${minFontSize}px`;
  const fitsAtMin =
    button.scrollWidth <= button.clientWidth + TOLERANCE_PX && !doesParentRowOverflow(button);

  if (fitsAtMin) {
    let low = minFontSize;
    let high = baseFontSize;
    for (let i = 0; i < SEARCH_STEPS; i += 1) {
      const mid = (low + high) / 2;
      button.style.fontSize = `${mid}px`;
      if (
        button.scrollWidth <= button.clientWidth + TOLERANCE_PX &&
        !doesParentRowOverflow(button)
      ) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const fittedSize = Math.floor(low * 2) / 2;
    button.style.fontSize = `${fittedSize}px`;
    return;
  }

  // Step 3: Still overflows at minFontSize -> keep minFontSize and either truncate or wrap balanced
  button.style.fontSize = `${minFontSize}px`;
  const hasExplicitCompactHeight =
    Boolean(button.style.height) && Number.parseFloat(button.style.height) <= 36;

  if (hasExplicitCompactHeight) {
    button.style.whiteSpace = 'nowrap';
    button.style.overflow = 'hidden';
    button.style.textOverflow = 'ellipsis';
    if (!button.title) {
      button.title = (button.textContent ?? '').trim();
    }
  } else {
    button.style.whiteSpace = 'normal';
    (button.style as unknown as Record<string, string>).textWrap = 'balance';
  }
}

export function useButtonTextFit(): void {
  const { i18n } = useTranslation();

  useEffect(() => {
    let frameId: number | null = null;
    let isApplying = false;

    const scheduleFitAll = () => {
      if (isApplying) return;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        frameId = null;
        isApplying = true;
        try {
          const buttons = document.querySelectorAll<HTMLButtonElement>('button');
          buttons.forEach(fitSingleButton);
        } finally {
          isApplying = false;
        }
      });
    };

    scheduleFitAll();

    const mutationObserver = new MutationObserver(() => {
      scheduleFitAll();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const handleResize = () => {
      scheduleFitAll();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [i18n.language]);
}
