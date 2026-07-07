import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { scanImage, checkOcrServiceHealth } from "@/lib/ocr";

const enabled = Boolean(process.env.OCR_SERVICE_URL?.trim());

describe.skipIf(!enabled)("ocr sidecar contract", () => {
  it("is reachable", async () => {
    await expect(checkOcrServiceHealth()).resolves.toBe(true);
  });

  it(
    "scans a rendered text image and returns well-formed regions",
    { timeout: 180_000 },
    async () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
        <rect width="600" height="400" fill="white"/>
        <text x="60" y="200" font-size="48" fill="black">\u3053\u3093\u306b\u3061\u306f\u4e16\u754c</text>
      </svg>`;
      const png = await sharp(Buffer.from(svg)).png().toBuffer();

      const regions = await scanImage(png, "image/png");
      // Detection quality is model-dependent; the CONTRACT assertions are shape-level.
      for (const region of regions) {
        expect(region.maxX).toBeGreaterThan(region.minX);
        expect(region.maxY).toBeGreaterThan(region.minY);
        expect(region.ocrText.trim().length).toBeGreaterThan(0);
        // Typeset metadata (Task 2 parse output). Presence is model/config-dependent,
        // so we only pin the SHAPE: reported colors must be `#rrggbb` (else null).
        expect(region.textColorFg === null || /^#[0-9a-f]{6}$/.test(region.textColorFg)).toBe(true);
        expect(region.textColorBg === null || /^#[0-9a-f]{6}$/.test(region.textColorBg)).toBe(true);
      }
    }
  );

  it(
    "returns an empty region list for a text-free page instead of erroring",
    { timeout: 180_000 },
    async () => {
      // Canary for the upstream no-text path: manga-image-translator emits a
      // `skip-no-regions`/`skip-no-text` progress state and then surfaces a
      // stream ERROR frame (it crashes serializing the empty result). scanImage
      // MUST treat that as a COMPLETE zero-region scan. If a future sidecar
      // stops emitting the skip signal, fixes the crash, or renames the state,
      // this fails loudly instead of silently regressing pages back to FAILED.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
        <rect width="600" height="400" fill="white"/>
      </svg>`;
      const png = await sharp(Buffer.from(svg)).png().toBuffer();

      await expect(scanImage(png, "image/png")).resolves.toEqual([]);
    }
  );
});
