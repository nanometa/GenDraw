/**
 * AnimatedDots — falling-dots canvas animation used as the site-wide
 * background. Every dot picks a random colour from the palette, falls
 * from the top, fades through a colour ramp on the way down, and resets
 * to the top when it leaves the bottom edge.
 *
 * Adapted from the upstream "animated-dots" recipe; kept free of any
 * Next.js / styled-jsx specifics so it runs cleanly under Vite. The
 * component is purely visual — wire it once at the App level and let
 * every route render on top of it.
 */

import { useEffect, useRef } from 'react';

type ColorChannel = 'red' | 'green' | 'blue';
type ColorEntry = [ColorChannel, number, number, number];

interface AnimatedDotsProps {
  dotsNum?: number;
  dotRadius?: number;
  dotSpacing?: number;
  speedRange?: [number, number];
  backgroundColor?: string;
  opacity?: number;
  blendMode?: GlobalCompositeOperation;
  fullScreen?: boolean;
  className?: string;
  colors?: ColorEntry[];
}

const DEFAULT_COLORS: ColorEntry[] = [
  ['red', 255, 69, 58],
  ['red', 255, 149, 0], // orange — the channel ramp on `red` slides this from yellow → orange
  ['red', 255, 214, 10], // yellow
  ['green', 52, 199, 89],
  ['blue', 0, 122, 255],
  ['blue', 88, 86, 214], // indigo
  ['red', 175, 82, 222], // purple
  ['red', 255, 45, 85], // pink
];

interface InternalDot {
  velocity: number;
  ranVelocity: number;
  ranColor: number;
  radius: number;
  x: number;
  y: number;
}

export function AnimatedDots({
  dotsNum = 60,
  dotRadius = 10,
  dotSpacing = 0,
  speedRange = [1, 4],
  backgroundColor = 'transparent',
  opacity = 1,
  blendMode = 'normal' as GlobalCompositeOperation,
  fullScreen = true,
  className = '',
  colors = DEFAULT_COLORS,
}: AnimatedDotsProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dotsRef = useRef<InternalDot[]>([]);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const TWO_PI = 2 * Math.PI;
    let width = fullScreen ? window.innerWidth : canvas.offsetWidth;
    let height = fullScreen ? window.innerHeight : canvas.offsetHeight;

    const updateColors = (
      selectedColor: ColorEntry,
      increment: number,
    ): string => {
      let [type, r, g, b] = selectedColor;
      if (type === 'red') r = increment;
      else if (type === 'green') g = increment;
      else if (type === 'blue') b = increment;
      return `rgba(${r}, ${g}, ${b}, 1)`;
    };

    const drawDot = (dot: InternalDot): void => {
      dot.velocity += dot.ranVelocity;
      const colorIncrement =
        255 - Math.round(dot.velocity * (255 / (height + dot.radius)));
      const palette = colors[dot.ranColor];
      if (!palette) return;
      ctx.fillStyle = updateColors(palette, colorIncrement);
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;

      if (dot.velocity >= height + dot.radius) {
        dot.velocity = 0;
        dot.ranColor = Math.round(Math.random() * (colors.length - 1));
        dot.ranVelocity =
          Math.random() * (speedRange[1] - speedRange[0]) + speedRange[0];
      }

      dot.y = -dot.radius + dot.velocity;

      ctx.beginPath();
      ctx.arc(dot.x % width, dot.y, dot.radius, 0, TWO_PI, false);
      ctx.fill();
    };

    const createDots = (): void => {
      const arr: InternalDot[] = [];
      for (let i = 0; i < dotsNum; i++) {
        arr.push({
          velocity: 0,
          radius: dotRadius,
          ranVelocity:
            Math.random() * (speedRange[1] - speedRange[0]) + speedRange[0],
          ranColor: Math.round(Math.random() * (colors.length - 1)),
          x: dotRadius + i * (dotRadius * 2 + dotSpacing),
          y: -dotRadius,
        });
      }
      dotsRef.current = arr;
    };

    const resizeCanvas = (): void => {
      width = fullScreen ? window.innerWidth : canvas.offsetWidth;
      height = fullScreen ? window.innerHeight : canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      createDots();
    };

    const draw = (): void => {
      // When the host wants no trail effect they pass `transparent`
      // (or omit the prop). In that case we wipe the canvas with
      // `clearRect` so each frame is a clean slate — no streak
      // accumulates behind the falling dots. Otherwise we paint the
      // configured colour on top of the previous frame, which is what
      // gives the rainbow-trail look.
      if (backgroundColor === 'transparent') {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }
      for (const dot of dotsRef.current) drawDot(dot);
      animationRef.current = window.requestAnimationFrame(draw);
    };

    resizeCanvas();
    draw();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current !== null) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    dotsNum,
    dotRadius,
    colors,
    dotSpacing,
    speedRange,
    backgroundColor,
    opacity,
    blendMode,
    fullScreen,
  ]);

  return (
    <div
      className={`relative ${fullScreen ? 'w-screen h-screen' : ''} ${className}`.trim()}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

export default AnimatedDots;
