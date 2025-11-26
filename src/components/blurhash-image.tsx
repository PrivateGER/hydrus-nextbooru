"use client";

import { useEffect, useRef } from "react";
import { decode } from "blurhash";

interface BlurhashImageProps {
  blurhash: string;
  width: number;
  height: number;
  className?: string;
}

export function BlurhashImage({ blurhash, width, height, className }: BlurhashImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Decode at a small resolution for performance
      const pixels = decode(blurhash, 32, 32);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.createImageData(32, 32);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      // Invalid blurhash, leave canvas empty
    }
  }, [blurhash]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className={className}
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}
