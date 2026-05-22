/**
 * FullScreenScrollFX — scroll-pinned fullscreen slideshow with animated
 * masked-word title transitions, parallax background fades, and
 * side-tracked label lists. Adapted from the upstream "scroll-fx"
 * recipe (Next.js styled-jsx) for use under Vite by extracting the
 * styles to a sibling .css file.
 */

import {
  CSSProperties,
  ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './full-screen-scroll-fx.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

type Section = {
  id?: string;
  background: string;
  leftLabel?: ReactNode;
  title: string | ReactNode;
  /** Optional content rendered below the animated title (e.g. a form
   *  or a list). Stays untouched by the masked-word animation. */
  content?: ReactNode;
  rightLabel?: ReactNode;
  renderBackground?: (active: boolean, previous: boolean) => ReactNode;
};

type Colors = Partial<{
  text: string;
  overlay: string;
  pageBg: string;
  stageBg: string;
}>;

type Durations = Partial<{
  change: number;
  snap: number;
}>;

export type FullScreenFXAPI = {
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  getIndex: () => number;
  refresh: () => void;
};

export type FullScreenFXProps = {
  sections: Section[];
  className?: string;
  style?: CSSProperties;

  fontFamily?: string;
  header?: ReactNode;
  footer?: ReactNode;
  gap?: number;
  gridPaddingX?: number;
  showProgress?: boolean;
  debug?: boolean;

  durations?: Durations;
  reduceMotion?: boolean;
  smoothScroll?: boolean;

  bgTransition?: 'fade' | 'wipe';
  parallaxAmount?: number;

  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  initialIndex?: number;

  colors?: Colors;

  apiRef?: React.Ref<FullScreenFXAPI>;
  ariaLabel?: string;
};

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

export const FullScreenScrollFX = forwardRef<HTMLDivElement, FullScreenFXProps>(
  (
    {
      sections,
      className,
      style,
      fontFamily = '"Rubik Wide", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      header,
      footer,
      gap = 1,
      gridPaddingX = 2,
      showProgress = true,
      debug = false,
      durations = { change: 0.7, snap: 800 },
      reduceMotion,
      bgTransition = 'fade',
      parallaxAmount = 4,
      currentIndex,
      onIndexChange,
      initialIndex = 0,
      colors = {
        text: 'rgba(245,245,245,0.92)',
        overlay: 'rgba(0,0,0,0.35)',
        pageBg: '#ffffff',
        stageBg: '#000000',
      },
      apiRef,
      ariaLabel = 'Full screen scroll slideshow',
    },
    ref,
  ) => {
    const total = sections.length;
    const [localIndex, setLocalIndex] = useState(
      clamp(initialIndex, 0, Math.max(0, total - 1)),
    );
    const isControlled = typeof currentIndex === 'number';
    const index = isControlled
      ? clamp(currentIndex!, 0, Math.max(0, total - 1))
      : localIndex;

    const rootRef = useRef<HTMLDivElement | null>(null);
    const fixedRef = useRef<HTMLDivElement | null>(null);
    const fixedSectionRef = useRef<HTMLDivElement | null>(null);
    const bgRefs = useRef<HTMLImageElement[]>([]);
    const wordRefs = useRef<HTMLSpanElement[][]>([]);
    const leftTrackRef = useRef<HTMLDivElement | null>(null);
    const rightTrackRef = useRef<HTMLDivElement | null>(null);
    const leftItemRefs = useRef<HTMLDivElement[]>([]);
    const rightItemRefs = useRef<HTMLDivElement[]>([]);
    const progressFillRef = useRef<HTMLDivElement | null>(null);
    const currentNumberRef = useRef<HTMLSpanElement | null>(null);

    const stRef = useRef<ScrollTrigger | null>(null);
    const lastIndexRef = useRef(index);
    const isAnimatingRef = useRef(false);
    const isSnappingRef = useRef(false);
    const sectionTopRef = useRef<number[]>([]);

    const prefersReduced = useMemo(() => {
      if (typeof window === 'undefined') return false;
      return (
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    }, []);
    const motionOff = reduceMotion ?? prefersReduced;

    const splitWords = (text: string, sIdx: number) => {
      const words = text.split(/\s+/).filter(Boolean);
      return words.map((w, wIdx) => (
        <span className="fx-word-mask" key={wIdx}>
          <span
            className="fx-word"
            ref={(el) => {
              // Stable per-(section, word) ref callback. We write into
              // `wordRefs[sIdx][wIdx]` directly so each slide owns its
              // own bucket — the previous shared-bucket approach lost
              // every section but the first because all ref callbacks
              // pushed into the same array during render and the
              // WordsCollector effects only saw the leftover from the
              // last iteration.
              if (!wordRefs.current[sIdx]) wordRefs.current[sIdx] = [];
              if (el) wordRefs.current[sIdx]![wIdx] = el;
            }}
          >
            {w}
          </span>
          {wIdx < words.length - 1 ? ' ' : null}
        </span>
      ));
    };

    const measureRAF = (fn: () => void): void => {
      if (typeof window === 'undefined') return;
      requestAnimationFrame(() => requestAnimationFrame(fn));
    };

    const computePositions = (): void => {
      const el = fixedSectionRef.current;
      if (!el) return;
      const top = el.offsetTop;
      const h = el.offsetHeight;
      const arr: number[] = [];
      for (let i = 0; i < total; i++) arr.push(top + (h * i) / total);
      sectionTopRef.current = arr;
    };

    const measureAndCenterLists = (
      toIndex = index,
      animate = true,
    ): void => {
      const centerTrack = (
        container: HTMLDivElement | null,
        items: HTMLDivElement[],
        isRight: boolean,
      ): void => {
        if (!container || items.length === 0) return;
        const first = items[0];
        if (!first) return;
        const second = items[1];
        const contRect = container.getBoundingClientRect();
        let rowH = first.getBoundingClientRect().height;
        if (second) {
          rowH =
            second.getBoundingClientRect().top -
            first.getBoundingClientRect().top;
        }
        const targetY = contRect.height / 2 - rowH / 2 - toIndex * rowH;
        const prop = isRight ? rightTrackRef : leftTrackRef;
        if (!prop.current) return;
        if (animate) {
          gsap.to(prop.current, {
            y: targetY,
            duration: (durations.change ?? 0.7) * 0.9,
            ease: 'power3.out',
          });
        } else {
          gsap.set(prop.current, { y: targetY });
        }
      };

      measureRAF(() => {
        measureRAF(() => {
          centerTrack(leftTrackRef.current, leftItemRefs.current, false);
          centerTrack(rightTrackRef.current, rightItemRefs.current, true);
        });
      });
    };

    const changeSection = (to: number): void => {
      if (to === lastIndexRef.current || isAnimatingRef.current) return;
      const from = lastIndexRef.current;
      const down = to > from;
      isAnimatingRef.current = true;
      if (!isControlled) setLocalIndex(to);
      onIndexChange?.(to);

      if (currentNumberRef.current) {
        currentNumberRef.current.textContent = String(to + 1).padStart(2, '0');
      }
      if (progressFillRef.current) {
        const p = (to / (total - 1 || 1)) * 100;
        progressFillRef.current.style.width = `${p}%`;
      }

      const D = durations.change ?? 0.7;

      const outWords = wordRefs.current[from] || [];
      const inWords = wordRefs.current[to] || [];
      if (outWords.length) {
        gsap.to(outWords, {
          yPercent: down ? -100 : 100,
          opacity: 0,
          duration: D * 0.6,
          stagger: down ? 0.03 : -0.03,
          ease: 'power3.out',
        });
      }
      if (inWords.length) {
        gsap.set(inWords, { yPercent: down ? 100 : -100, opacity: 0 });
        gsap.to(inWords, {
          yPercent: 0,
          opacity: 1,
          duration: D,
          stagger: down ? 0.05 : -0.05,
          ease: 'power3.out',
        });
      }

      const prevBg = bgRefs.current[from];
      const newBg = bgRefs.current[to];
      if (bgTransition === 'fade') {
        if (newBg) {
          gsap.set(newBg, {
            opacity: 0,
            scale: 1.04,
            yPercent: down ? 1 : -1,
          });
          gsap.to(newBg, {
            opacity: 1,
            scale: 1,
            yPercent: 0,
            duration: D,
            ease: 'power2.out',
          });
        }
        if (prevBg) {
          gsap.to(prevBg, {
            opacity: 0,
            yPercent: down ? -parallaxAmount : parallaxAmount,
            duration: D,
            ease: 'power2.out',
          });
        }
      } else {
        if (newBg) {
          gsap.set(newBg, {
            opacity: 1,
            clipPath: down ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)',
            scale: 1,
            yPercent: 0,
          });
          gsap.to(newBg, {
            clipPath: 'inset(0 0 0 0)',
            duration: D,
            ease: 'power3.out',
          });
        }
        if (prevBg) {
          gsap.to(prevBg, {
            opacity: 0,
            duration: D * 0.8,
            ease: 'power2.out',
          });
        }
      }

      measureAndCenterLists(to, true);
      leftItemRefs.current.forEach((el, i) => {
        el.classList.toggle('active', i === to);
        gsap.to(el, {
          opacity: i === to ? 1 : 0.35,
          x: i === to ? 10 : 0,
          duration: D * 0.6,
          ease: 'power3.out',
        });
      });
      rightItemRefs.current.forEach((el, i) => {
        el.classList.toggle('active', i === to);
        gsap.to(el, {
          opacity: i === to ? 1 : 0.35,
          x: i === to ? -10 : 0,
          duration: D * 0.6,
          ease: 'power3.out',
        });
      });

      gsap.delayedCall(D, () => {
        lastIndexRef.current = to;
        isAnimatingRef.current = false;
      });
    };

    const goTo = (to: number, withScroll = true): void => {
      const clamped = clamp(to, 0, total - 1);
      isSnappingRef.current = true;
      changeSection(clamped);
      const pos = sectionTopRef.current[clamped];
      const snapMs = durations.snap ?? 800;
      if (withScroll && typeof window !== 'undefined') {
        window.scrollTo({ top: pos, behavior: 'smooth' });
        setTimeout(() => (isSnappingRef.current = false), snapMs);
      } else {
        setTimeout(() => (isSnappingRef.current = false), 10);
      }
    };

    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);

    useImperativeHandle(apiRef, () => ({
      next,
      prev,
      goTo,
      getIndex: () => index,
      refresh: () => ScrollTrigger.refresh(),
    }));

    const handleJump = (i: number) => goTo(i);

    const handleLoadedStagger = (): void => {
      leftItemRefs.current.forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 20 },
          {
            opacity: i === index ? 1 : 0.35,
            y: 0,
            duration: 0.5,
            delay: i * 0.06,
            ease: 'power3.out',
          },
        );
      });
      rightItemRefs.current.forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 20 },
          {
            opacity: i === index ? 1 : 0.35,
            y: 0,
            duration: 0.5,
            delay: 0.2 + i * 0.06,
            ease: 'power3.out',
          },
        );
      });
    };

    useLayoutEffect(() => {
      if (typeof window === 'undefined') return;
      const fixed = fixedRef.current;
      const fs = fixedSectionRef.current;
      if (!fixed || !fs || total === 0) return;

      gsap.set(bgRefs.current, { opacity: 0, scale: 1.04, yPercent: 0 });
      if (bgRefs.current[0]) {
        gsap.set(bgRefs.current[0], { opacity: 1, scale: 1 });
      }

      wordRefs.current.forEach((words, sIdx) => {
        words.forEach((w) => {
          gsap.set(w, {
            yPercent: sIdx === index ? 0 : 100,
            opacity: sIdx === index ? 1 : 0,
          });
        });
      });

      computePositions();
      measureAndCenterLists(index, false);

      const st = ScrollTrigger.create({
        trigger: fs,
        start: 'top top',
        end: 'bottom bottom',
        pin: fixed,
        pinSpacing: true,
        onUpdate: (self) => {
          if (motionOff || isSnappingRef.current) return;
          const prog = self.progress;
          const target = Math.min(total - 1, Math.floor(prog * total));
          if (target !== lastIndexRef.current && !isAnimatingRef.current) {
            const next2 =
              lastIndexRef.current +
              (target > lastIndexRef.current ? 1 : -1);
            goTo(next2, false);
          }
          if (progressFillRef.current) {
            const p = (lastIndexRef.current / (total - 1 || 1)) * 100;
            progressFillRef.current.style.width = `${p}%`;
          }
        },
      });
      stRef.current = st;

      if (initialIndex && initialIndex > 0 && initialIndex < total) {
        requestAnimationFrame(() => goTo(initialIndex, false));
      }

      const ro = new ResizeObserver(() => {
        computePositions();
        measureAndCenterLists(lastIndexRef.current, false);
        ScrollTrigger.refresh();
      });
      ro.observe(fs);

      return () => {
        ro.disconnect();
        st.kill();
        stRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total, initialIndex, motionOff, bgTransition, parallaxAmount]);

    useEffect(() => {
      handleLoadedStagger();
      measureAndCenterLists(index, false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cssVars: CSSProperties = {
      ['--fx-font' as never]: fontFamily,
      ['--fx-text' as never]: colors.text ?? 'rgba(245,245,245,0.92)',
      ['--fx-overlay' as never]: colors.overlay ?? 'rgba(0,0,0,0.35)',
      ['--fx-page-bg' as never]: colors.pageBg ?? '#fff',
      ['--fx-stage-bg' as never]: colors.stageBg ?? '#000',
      ['--fx-gap' as never]: `${gap}rem`,
      ['--fx-grid-px' as never]: `${gridPaddingX}rem`,
      ['--fx-row-gap' as never]: '10px',
      ['--fx-section-count' as never]: String(total),
    };

    return (
      <div
        ref={(node) => {
          (rootRef as { current: HTMLDivElement | null }).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref)
            (ref as React.MutableRefObject<HTMLDivElement | null>).current =
              node;
        }}
        className={['fx', className].filter(Boolean).join(' ')}
        style={{ ...cssVars, ...style }}
        aria-label={ariaLabel}
      >
        {debug && <div className="fx-debug">Section: {index}</div>}

        <div className="fx-scroll">
          <div className="fx-fixed-section" ref={fixedSectionRef}>
            <div className="fx-fixed" ref={fixedRef}>
              <div className="fx-bgs" aria-hidden="true">
                {sections.map((s, i) => (
                  <div className="fx-bg" key={s.id ?? i}>
                    {s.renderBackground ? (
                      s.renderBackground(index === i, lastIndexRef.current === i)
                    ) : s.background ? (
                      <>
                        <img
                          ref={(el) => {
                            if (el) bgRefs.current[i] = el;
                          }}
                          src={s.background}
                          alt=""
                          className="fx-bg-img"
                        />
                        <div className="fx-bg-overlay" />
                      </>
                    ) : (
                      // No photo backdrop on this slide — the host
                      // page already paints whatever it wants behind
                      // the slideshow (e.g. a global AnimatedDots
                      // canvas). We render a transparent placeholder
                      // so the active-bg index bookkeeping stays in
                      // sync (`bgRefs[i]` is never read for null
                      // slots in `changeSection`'s gsap calls).
                      null
                    )}
                  </div>
                ))}
              </div>

              <div className="fx-grid">
                {header && <div className="fx-header">{header}</div>}

                <div className="fx-content">
                  <div className="fx-left" role="list">
                    <div className="fx-track" ref={leftTrackRef}>
                      {sections.map((s, i) => (
                        <div
                          key={`L-${s.id ?? i}`}
                          className={`fx-item fx-left-item ${i === index ? 'active' : ''}`}
                          ref={(el) => {
                            if (el) leftItemRefs.current[i] = el;
                          }}
                          onClick={() => handleJump(i)}
                          role="button"
                          tabIndex={0}
                          aria-pressed={i === index}
                        >
                          {s.leftLabel}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fx-center">
                    {sections.map((s, sIdx) => {
                      const isString = typeof s.title === 'string';
                      return (
                        <div
                          key={`C-${s.id ?? sIdx}`}
                          className={`fx-featured ${sIdx === index ? 'active' : ''}`}
                        >
                          {isString ? (
                            <h3 className="fx-featured-title">
                              {splitWords(s.title as string, sIdx)}
                            </h3>
                          ) : (
                            <div className="fx-featured-content">
                              {s.title}
                            </div>
                          )}
                          {s.content ? (
                            <div className="fx-featured-content">
                              {s.content}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="fx-right" role="list">
                    <div className="fx-track" ref={rightTrackRef}>
                      {sections.map((s, i) => (
                        <div
                          key={`R-${s.id ?? i}`}
                          className={`fx-item fx-right-item ${i === index ? 'active' : ''}`}
                          ref={(el) => {
                            if (el) rightItemRefs.current[i] = el;
                          }}
                          onClick={() => handleJump(i)}
                          role="button"
                          tabIndex={0}
                          aria-pressed={i === index}
                        >
                          {s.rightLabel}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="fx-footer">
                  {footer && <div className="fx-footer-title">{footer}</div>}
                  {showProgress && (
                    <div className="fx-progress">
                      <div className="fx-progress-numbers">
                        <span ref={currentNumberRef}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span>{String(total).padStart(2, '0')}</span>
                      </div>
                      <div className="fx-progress-bar">
                        <div
                          className="fx-progress-fill"
                          ref={progressFillRef}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="fx-end">
            <p className="fx-fin">fin</p>
          </div>
        </div>
      </div>
    );
  },
);

FullScreenScrollFX.displayName = 'FullScreenScrollFX';
