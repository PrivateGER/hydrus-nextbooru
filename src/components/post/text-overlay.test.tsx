/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TextOverlay, type OverlayRegion } from './text-overlay';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

class NoopResizeObserver {
  observe() {}
  disconnect() {}
}

globalThis.ResizeObserver = NoopResizeObserver as typeof ResizeObserver;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const region: OverlayRegion = {
  readingOrder: 0,
  x: 0.1,
  y: 0.2,
  width: 0.3,
  height: 0.1,
  ocrText: '日本語',
  translatedText: 'English',
  sourceLanguage: 'ja',
  hasCrop: true,
  textColorFg: '#111111',
  textColorBg: '#eeeeee',
  cropVersion: 123,
};

describe('TextOverlay', () => {
  it('uses a full-page inpaint layer for typeset mode before per-region crop fallback', async () => {
    localStorage.clear();
    localStorage.setItem('ocrOverlayMode', 'typeset');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<TextOverlay hash="abcdef" initialRegions={[region]} ocrEnabled={true} />);
    });

    expect(host.querySelector('img[src="/api/ocr-pages/abcdef?v=123"]')).not.toBeNull();
    expect(host.querySelector('img[src="/api/ocr-crops/abcdef/0?v=123"]')).toBeNull();
    expect(host.textContent).toContain('English');

    await act(async () => {
      root.unmount();
    });
  });

  it('uses full-page typeset text even when a region crop is unavailable', async () => {
    localStorage.clear();
    localStorage.setItem('ocrOverlayMode', 'typeset');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <TextOverlay
          hash="abcdef"
          initialRegions={[{ ...region, hasCrop: false }]}
          ocrEnabled={true}
        />
      );
    });

    expect(host.querySelector('img[src="/api/ocr-pages/abcdef?v=123"]')).not.toBeNull();
    expect(host.querySelector('img[src="/api/ocr-crops/abcdef/0?v=123"]')).toBeNull();
    expect(host.textContent).toContain('English');

    await act(async () => {
      root.unmount();
    });
  });

  it('defaults to full-page typeset mode when no overlay preference is saved', async () => {
    localStorage.clear();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<TextOverlay hash="abcdef" initialRegions={[region]} ocrEnabled={true} />);
    });

    expect(host.querySelector('img[src="/api/ocr-pages/abcdef?v=123"]')).not.toBeNull();
    expect(host.querySelector('img[src="/api/ocr-crops/abcdef/0?v=123"]')).toBeNull();
    expect(host.textContent).toContain('English');

    await act(async () => {
      root.unmount();
    });
  });

  it('migrates legacy visible overlay preference to full-page typeset mode', async () => {
    localStorage.clear();
    localStorage.setItem('ocrOverlayVisible', 'true');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<TextOverlay hash="abcdef" initialRegions={[region]} ocrEnabled={true} />);
    });

    expect(localStorage.getItem('ocrOverlayMode')).toBe('typeset');
    expect(localStorage.getItem('ocrOverlayVisible')).toBeNull();
    expect(host.querySelector('img[src="/api/ocr-pages/abcdef?v=123"]')).not.toBeNull();
    expect(host.querySelector('img[src="/api/ocr-crops/abcdef/0?v=123"]')).toBeNull();
    expect(host.textContent).toContain('English');

    await act(async () => {
      root.unmount();
    });
  });

  it('does not downgrade a saved typeset preference on posts without OCR regions', async () => {
    localStorage.clear();
    localStorage.setItem('ocrOverlayMode', 'typeset');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<TextOverlay hash="abcdef" initialRegions={[]} ocrEnabled={true} />);
    });

    expect(localStorage.getItem('ocrOverlayMode')).toBe('typeset');
    expect(host.querySelector('img[src^="/api/ocr-pages/"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
