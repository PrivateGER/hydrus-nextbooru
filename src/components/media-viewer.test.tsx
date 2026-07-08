/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { MediaViewer } from './media-viewer';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, ...props }, children),
}));

type ActivityMode = 'hidden' | 'visible';
type ActivityComponent = React.ComponentType<{ mode?: ActivityMode; children: React.ReactNode }>;

type ReactWithActivity = typeof React & {
  Activity?: ActivityComponent;
  unstable_Activity?: ActivityComponent;
};

const ActivityBoundary =
  (React as ReactWithActivity).Activity ?? (React as ReactWithActivity).unstable_Activity ?? null;
const activityIt = ActivityBoundary ? it : it.skip;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedRoot {
  root: Root;
  host: HTMLDivElement;
}

let playSpy: MockInstance<() => Promise<void>>;
let pauseSpy: MockInstance<() => void>;

beforeEach(() => {
  playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});

afterEach(() => {
  playSpy.mockRestore();
  pauseSpy.mockRestore();
});

function createMountedRoot(): MountedRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return { root: createRoot(host), host };
}

async function destroyMountedRoot({ root, host }: MountedRoot) {
  await act(async () => {
    root.unmount();
  });
  host.remove();
}

function renderVideo(mode?: ActivityMode) {
  const viewer = <MediaViewer hash="video-hash" extension=".mp4" mimeType="video/mp4" />;

  if (!ActivityBoundary || !mode) return viewer;

  return <ActivityBoundary mode={mode}>{viewer}</ActivityBoundary>;
}

function renderUnsupportedMedia(mode?: ActivityMode) {
  const viewer = <MediaViewer hash="document-hash" extension=".pdf" mimeType="application/pdf" />;

  if (!ActivityBoundary || !mode) return viewer;

  return <ActivityBoundary mode={mode}>{viewer}</ActivityBoundary>;
}

describe('MediaViewer video playback lifecycle', () => {
  it('attempts video playback on visible mount and pauses the same video on unmount', async () => {
    const mounted = createMountedRoot();

    await act(async () => {
      mounted.root.render(renderVideo());
    });

    const video = mounted.host.querySelector('video');
    expect(video).not.toBeNull();
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(playSpy.mock.contexts[0]).toBe(video);
    expect(pauseSpy).not.toHaveBeenCalled();

    await destroyMountedRoot(mounted);

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(pauseSpy.mock.contexts[0]).toBe(video);
  });

  activityIt('pauses when Activity hides the video and attempts playback again when Activity becomes visible', async () => {
    const mounted = createMountedRoot();

    await act(async () => {
      mounted.root.render(renderVideo('visible'));
    });

    const video = mounted.host.querySelector('video');
    expect(video).not.toBeNull();
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(playSpy.mock.contexts[0]).toBe(video);

    await act(async () => {
      mounted.root.render(renderVideo('hidden'));
    });

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(pauseSpy.mock.contexts[0]).toBe(video);

    await act(async () => {
      mounted.root.render(renderVideo('visible'));
    });

    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(playSpy.mock.contexts[1]).toBe(video);

    await destroyMountedRoot(mounted);
  });

  activityIt('renders no video for non-video media and Activity visibility toggles do not call media methods', async () => {
    const mounted = createMountedRoot();

    await act(async () => {
      mounted.root.render(renderUnsupportedMedia('visible'));
    });

    expect(mounted.host.querySelector('video')).toBeNull();
    expect(mounted.host.textContent).toContain('Preview not available for application/pdf');

    await act(async () => {
      mounted.root.render(renderUnsupportedMedia('hidden'));
    });
    await act(async () => {
      mounted.root.render(renderUnsupportedMedia('visible'));
    });

    expect(mounted.host.querySelector('video')).toBeNull();
    expect(playSpy).not.toHaveBeenCalled();
    expect(pauseSpy).not.toHaveBeenCalled();

    await destroyMountedRoot(mounted);
  });
});
