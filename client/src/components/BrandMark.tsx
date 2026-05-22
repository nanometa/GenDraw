/**
 * BrandMark — fixed top-left logo for GenDraw.
 *
 * The artwork is the user-supplied PNG dropped at
 * `client/public/brand-logo.png`. The PNG was exported with a solid
 * black background (Photoroom export, no alpha cutout), so a naive
 * `<img>` placement would draw a black square around the silhouette
 * regardless of the layer behind it.
 *
 * Solution: at mount time we load the PNG into an off-screen canvas,
 * walk the pixel buffer, and rewrite every near-black pixel's alpha
 * channel to 0. The cleaned-up image is re-emitted as a data URL and
 * fed to a regular `<img>` — which means it composites correctly
 * against any background (the MorphicBackground here, but also the
 * lighter card surfaces on Lobby / Game), with no blend-mode tricks.
 *
 * Once the silhouette is properly transparent we layer a CSS
 * `filter: hue-rotate` animation on top (`brand-hue-cycle` keyframe,
 * defined in `theme.css`). hue-rotate operates on rendered pixels,
 * so the silhouette itself never changes shape — only its hue does,
 * cycling through the colour wheel on a 6-second linear loop. The
 * logo "rainbows" while staying perfectly identical to the source.
 *
 * On hover the wrapper scales up slightly and the colour cycle
 * accelerates to ~2.4s for a small "the brand is alive" affordance.
 *
 * Replacing the artwork later is a one-file drop: copy a new
 * `brand-logo.png` into `client/public/`.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/** Path to the source PNG, served directly by Vite from `/public/`. */
const SOURCE_URL = '/brand-logo.png';

/**
 * Pixels with a luminance below this threshold (on a 0–255 scale) are
 * treated as background and made fully transparent. The user's PNG
 * has a near-pure-black background and a saturated orange foreground,
 * so a moderate threshold cleanly separates the two without nibbling
 * into the silhouette's anti-aliased edge.
 */
const BLACK_LUMA_THRESHOLD = 30;

/**
 * Strip the black background out of a PNG by clearing the alpha of
 * every pixel below `BLACK_LUMA_THRESHOLD`. Returns a `data:image/png`
 * URL ready to feed to an `<img>` element. Resolves to `null` if the
 * browser blocks canvas readback (e.g. CORS / file:// edge cases).
 */
function blackToTransparent(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx === null) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      try {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const buf = frame.data;
        for (let i = 0; i < buf.length; i += 4) {
          const r = buf[i] ?? 0;
          const g = buf[i + 1] ?? 0;
          const b = buf[i + 2] ?? 0;
          // Standard Rec. 601 luminance. Cheap, and good enough to
          // separate near-black pixels from saturated colours.
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luma < BLACK_LUMA_THRESHOLD) {
            buf[i + 3] = 0;
          }
        }
        ctx.putImageData(frame, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        // Tainted canvas — fall back to the original URL so the user
        // still sees their logo, just with the black background.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function BrandMark(): JSX.Element {
  const [src, setSrc] = useState<string>(SOURCE_URL);

  useEffect(() => {
    let cancelled = false;
    void blackToTransparent(SOURCE_URL).then((cleaned) => {
      if (cancelled || cleaned === null) return;
      setSrc(cleaned);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      to="/"
      aria-label="GenDraw home"
      className={[
        'group fixed left-3 top-3 z-30',
        'h-14 w-14 sm:h-16 sm:w-16',
        'transition-transform duration-200 hover:scale-110',
        'drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]',
      ].join(' ')}
    >
      {/*
        Cleaned-up silhouette. The `brand-hue-cycle` class drives a
        CSS hue-rotate animation that sweeps the orange through the
        colour wheel, so the logo cycles "rainbow" without us ever
        modifying the underlying asset's shape. `select-none` and
        `draggable={false}` stop the asset behaving like a draggable
        image when the user accidentally clicks-and-drags from the
        corner of the badge.
      */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="brand-hue-cycle h-full w-full object-contain select-none"
      />
    </Link>
  );
}
