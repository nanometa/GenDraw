/**
 * MorphicBackground — full-bleed canvas of coloured balls floating
 * upwards with a sine wobble. The container has a `goo` SVG filter
 * (Gaussian blur + alpha threshold) that fuses balls into organic
 * blobs the moment they touch — when two coloured circles overlap
 * the filter renders the union as a smooth merged shape, giving the
 * illusion of paint mixing.
 *
 * Adapted from the upstream "morphic background" component for our
 * site:
 *  - Each particle picks a colour at random from a palette so the
 *    page picks up the GenDraw rainbow vibe instead of being
 *    monochrome.
 *  - The container is fully transparent — the host page paints
 *    whatever background it wants behind us.
 */

import React, { useEffect, useRef } from 'react';

class Particle {
  private element: SVGElement;
  private container: HTMLElement;
  private position: number;
  private friction: number;
  private coordinates: { x: number; y: number };
  private scale: number;
  private siner: number;
  private rotationDirection: '+' | '-';
  private rotationValue: number;
  private ballColor: string;
  private readonly steps: number;
  private readonly dimensions = { width: 30, height: 30 };

  constructor(
    container: HTMLElement,
    coordinates: { x: number; y: number },
    friction: number,
    ballColor: string,
  ) {
    this.container = container;
    this.coordinates = coordinates;
    this.friction = friction;
    this.ballColor = ballColor;
    this.position = this.coordinates.y;
    this.steps = window.innerHeight / 2;
    this.rotationValue = 0;
    this.rotationDirection = Math.random() > 0.5 ? '+' : '-';
    this.scale = 0.4 + Math.random() * 2;
    this.siner = (window.innerWidth / 2.5) * Math.random();
    this.element = this.render();
  }

  private render(): SVGElement {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(svgNS, 'svg');
    svgEl.setAttribute('viewBox', '0 0 67.4 67.4');

    const circleEl = document.createElementNS(svgNS, 'circle');
    circleEl.setAttribute('cx', '33.7');
    circleEl.setAttribute('cy', '33.7');
    circleEl.setAttribute('r', '33.7');
    circleEl.setAttribute('fill', this.ballColor);
    svgEl.appendChild(circleEl);

    svgEl.style.position = 'absolute';
    svgEl.style.width = `${this.dimensions.width}px`;
    svgEl.style.height = `${this.dimensions.height}px`;
    svgEl.style.transform = `translateX(${this.coordinates.x}px) translateY(${this.coordinates.y}px)`;
    this.container.appendChild(svgEl);
    return svgEl;
  }

  public move(): boolean {
    this.position -= this.friction;
    const top = this.position;
    const left =
      this.coordinates.x +
      Math.sin((this.position * Math.PI) / this.steps) * this.siner;
    this.rotationValue += this.friction;
    const rotation =
      this.rotationDirection === '+' ? this.rotationValue : -this.rotationValue;
    this.element.style.transform = `translateX(${left}px) translateY(${top}px) scale(${this.scale}) rotate(${rotation}deg)`;
    if (this.position < -this.dimensions.height) {
      this.destroy();
      return false;
    }
    return true;
  }

  private destroy(): void {
    this.element.remove();
  }
}

interface MorphicBackgroundProps {
  /** Palette to draw from. Each spawning particle picks one entry at
   *  random so the page reads as a slow rainbow lava lamp. */
  colors?: string[];
  /** Spawn cadence in ms. Lower = denser cloud. Default 180. */
  spawnInterval?: number;
  /** Optional className applied to the underlying transparent layer.
   *  Defaults to a transparent backdrop so the host page's bg shines
   *  through. */
  className?: string;
}

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#facc15', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export const MorphicBackground: React.FC<MorphicBackgroundProps> = ({
  colors = DEFAULT_COLORS,
  spawnInterval = 180,
  className = 'absolute inset-0 -z-20',
}) => {
  const particleContainerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>();
  const isPausedRef = useRef(false);

  useEffect(() => {
    const container = particleContainerRef.current;
    if (!container) return;

    const handleFocus = () => {
      isPausedRef.current = false;
    };
    const handleBlur = () => {
      isPausedRef.current = true;
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    const particleInterval = window.setInterval(() => {
      if (!isPausedRef.current && container) {
        const palette = colors.length > 0 ? colors : DEFAULT_COLORS;
        const colour =
          palette[Math.floor(Math.random() * palette.length)] ??
          DEFAULT_COLORS[0]!;
        const newParticle = new Particle(
          container,
          {
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + 100,
          },
          1 + Math.random(),
          colour,
        );
        particlesRef.current.push(newParticle);
      }
    }, spawnInterval);

    const update = () => {
      particlesRef.current = particlesRef.current.filter((p) => p.move());
      animationFrameId.current = window.requestAnimationFrame(update);
    };
    update();

    return () => {
      window.clearInterval(particleInterval);
      if (animationFrameId.current !== undefined) {
        window.cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (container) container.innerHTML = '';
    };
  }, [colors, spawnInterval]);

  return (
    <>
      <div
        id="morphic-particles"
        ref={particleContainerRef}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ filter: "url('#morphic-goo')" }}
      />
      <div className={className} />
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="morphic-goo">
            {/* Soften every ball into a halo, then crank up the alpha
                so anywhere two halos overlap reads as a single blob. */}
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="12" />
            <feColorMatrix
              in="blur"
              result="colormatrix"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 21 -9"
            />
            <feBlend in="SourceGraphic" in2="colormatrix" />
          </filter>
        </defs>
      </svg>
    </>
  );
};

export default MorphicBackground;
