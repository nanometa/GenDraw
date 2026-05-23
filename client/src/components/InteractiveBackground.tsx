import { useEffect, useRef } from 'react';

// Neon graffiti colors
const GRAFFITI_COLORS = [
  '#00ffff', // Cyan
  '#ff00ff', // Magenta
  '#a855f7', // Purple
  '#39ff14', // Lime Green
  '#facc15', // Yellow
  '#ffffff', // White
];

export default function InteractiveBackground(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const isMoving = useRef(false);

  // Particles for the spray effect
  const particles = useRef<{ x: number; y: number; vx: number; vy: number; color: string; life: number; size: number }[]>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      isMoving.current = true;

      // Parallax effect
      if (containerRef.current) {
        const xOffset = (e.clientX / window.innerWidth - 0.5) * 20; // Max 10px move
        const yOffset = (e.clientY / window.innerHeight - 0.5) * 20;
        containerRef.current.style.transform = `translate(${-xOffset}px, ${-yOffset}px) scale(1.05)`;
      }

      // Spawn particles
      for (let i = 0; i < 3; i++) { // Spawn 3 particles per move
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2;
        particles.current.push({
          x: e.clientX + (Math.random() - 0.5) * 20, // Spread around cursor
          y: e.clientY + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: GRAFFITI_COLORS[Math.floor(Math.random() * GRAFFITI_COLORS.length)] || '#ffffff',
          life: 1.0, // 100% life
          size: Math.random() * 4 + 1 // 1px to 5px
        });
      }

      // Reset moving state shortly after stop
      setTimeout(() => { isMoving.current = false; }, 100);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      // Clear canvas slightly with alpha for trailing effect
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw cursor glow if moving
      if (isMoving.current) {
        const gradient = ctx.createRadialGradient(
          mousePos.current.x, mousePos.current.y, 0,
          mousePos.current.x, mousePos.current.y, 80
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(mousePos.current.x, mousePos.current.y, 80, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update and draw particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        if (!p) continue;
        
        // Physics update
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02; // Fade out speed

        if (p.life <= 0) {
          particles.current.splice(i, 1);
          continue;
        }

        // Draw particle
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1.0; // Reset alpha
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg-deep">
      {/* Background layer with parallax */}
      <div 
        ref={containerRef}
        className="absolute inset-[-5%] bg-cover bg-center bg-no-repeat transition-transform duration-100 ease-out"
        style={{ 
          backgroundImage: "url('/bagraound.png')",
          transform: 'scale(1.05)'
        }}
      />
      {/* Dark overlay to ensure text remains readable */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Decorative Graffiti Texts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <span className="absolute top-1/4 left-10 -rotate-12 font-display text-4xl text-cyan">Sketch It!</span>
        <span className="absolute bottom-1/3 right-12 rotate-6 font-display text-5xl text-pink">Ink Battle</span>
        <span className="absolute top-1/2 left-1/4 -rotate-6 font-display text-6xl text-yellow">Street Canvas</span>
        <span className="absolute bottom-1/4 left-1/3 rotate-12 font-display text-3xl text-purple-bright">No Rules, Just Art</span>
        <span className="absolute top-20 right-1/4 -rotate-3 font-display text-4xl text-green-bright">Guess Me!</span>
      </div>

      {/* Canvas for mouse spray effect */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 z-10 opacity-70"
      />
    </div>
  );
}
