import { useEffect, useRef } from 'react';

export type OrbeMaterial = 'gold_liquid' | 'graphite' | 'bronze' | 'opal';

interface VisualOrbeProps {
  isThinking: boolean;
  isSpeaking: boolean;
  mood?: string;
  material?: OrbeMaterial;
}

export default function VisualOrbe({ isThinking, isSpeaking, mood, material = 'gold_liquid' }: VisualOrbeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Map mood strings to materials if material is not explicitly overridden
  const activeMaterial: OrbeMaterial = (() => {
    if (material) return material;
    if (mood === 'focused') return 'gold_liquid';
    if (mood === 'cheeky') return 'opal';
    if (mood === 'surprised') return 'bronze';
    return 'graphite';
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    // Adjust for High-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // Base animation config based on material and thinking/speaking states
      let speed = 0.02;
      let baseRadius = 55;
      let ampMult = 0.8;

      if (isThinking) {
        speed = 0.07;
        ampMult = 1.6;
      } else if (isSpeaking) {
        speed = 0.045;
        ampMult = 1.25;
        baseRadius += Math.sin(time * 5) * 4;
      }

      // Material-specific parameter fine-tuning
      switch (activeMaterial) {
        case 'graphite':
          speed *= 0.5; // Very slow and calm
          ampMult *= 0.3; // Stiffer, rigid graphite structure
          break;
        case 'bronze':
          speed *= 0.2; // Barely moving, solid block
          ampMult *= 0.1; // Rigid, almost a perfect sphere
          break;
        case 'opal':
          speed *= 1.2; // Joyful, floating iridescence
          ampMult *= 1.1; 
          break;
        case 'gold_liquid':
        default:
          // Standard fluid gold
          break;
      }

      time += speed;

      const centerX = size / 2;
      const centerY = size / 2;

      // 1. Draw Ring Auras based on material
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 18 + Math.sin(time * 1.5) * 3, 0, Math.PI * 2);
      
      if (activeMaterial === 'gold_liquid') {
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
      } else if (activeMaterial === 'graphite') {
        ctx.strokeStyle = 'rgba(120, 120, 120, 0.08)';
      } else if (activeMaterial === 'bronze') {
        ctx.strokeStyle = 'rgba(205, 127, 50, 0.08)';
      } else {
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.12)';
      }
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Outer delicate orbital line
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + 32 + Math.cos(time * 0.9) * 2, 0, Math.PI * 2);
      if (activeMaterial === 'gold_liquid') {
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.04)';
      } else if (activeMaterial === 'graphite') {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.03)';
      } else if (activeMaterial === 'bronze') {
        ctx.strokeStyle = 'rgba(139, 92, 26, 0.04)';
      } else {
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.06)';
      }
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Build the fluid multi-wave morphing core
      const points = 120;
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;

        // Custom overlay wave structures depending on material
        let w1 = Math.sin(angle * 3 + time * 1.8) * 5 * ampMult;
        let w2 = Math.cos(angle * 5 - time * 1.3) * 3 * ampMult;
        let w3 = Math.sin(angle * 8 + time * 2.5) * 1.5 * ampMult;

        if (activeMaterial === 'opal') {
          // Extra wavy, iridescent motion
          w1 = Math.sin(angle * 4 + time * 2.2) * 6 * ampMult;
          w2 = Math.cos(angle * 6 - time * 1.7) * 4 * ampMult;
          w3 = Math.sin(angle * 10 + time * 3.3) * 2 * ampMult;
        }

        const currentRadius = baseRadius + w1 + w2 + w3;

        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();

      // 3. Create the Beautiful Material Gradient
      let grad = ctx.createRadialGradient(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        baseRadius * 0.05,
        centerX,
        centerY,
        baseRadius * 1.15
      );

      if (activeMaterial === 'gold_liquid') {
        // Celestial Sovereign Liquid Gold
        grad.addColorStop(0, '#fffcf3'); // Light champagne center
        grad.addColorStop(0.25, '#fddf8a'); // Soft warm gold
        grad.addColorStop(0.65, '#d4af37'); // Imperial gold
        grad.addColorStop(1, '#8c681b'); // Ancient solid bronze edge
      } else if (activeMaterial === 'graphite') {
        // Hermetic Dark Graphite with subtle gray-blue undertones
        grad.addColorStop(0, '#52525b'); // Soft zinc gray highlights
        grad.addColorStop(0.3, '#27272a'); // Intense dark slate
        grad.addColorStop(0.75, '#18181b'); // Obsidian graphite body
        grad.addColorStop(1, '#09090b'); // Absolute void edge
      } else if (activeMaterial === 'bronze') {
        // Sealed Ancient Bronze
        grad.addColorStop(0, '#fbe0c4'); // Copper highlight
        grad.addColorStop(0.3, '#cd7f32'); // Warm bronze
        grad.addColorStop(0.7, '#8c4f1c'); // Deep brown copper
        grad.addColorStop(1, '#3b1d11'); // Solid oxidized bronze edge
      } else if (activeMaterial === 'opal') {
        // Translucent Iridescent Opal
        const hueShift = (time * 15) % 360;
        grad.addColorStop(0, '#ffffff'); // Luminous white core
        grad.addColorStop(0.25, `hsla(${(hueShift + 60) % 360}, 75%, 90%, 0.9)`); // Iridescent yellow/green
        grad.addColorStop(0.55, `hsla(${(hueShift + 180) % 360}, 85%, 85%, 0.85)`); // Electric cyan/magenta
        grad.addColorStop(0.85, `hsla(${(hueShift + 280) % 360}, 80%, 75%, 0.8)`); // Royal lavender
        grad.addColorStop(1, '#93c5fd'); // Translucent soft blue rim
      }

      ctx.fillStyle = grad;
      ctx.fill();

      // 4. Overlap Material Specific Fine Details
      if (activeMaterial === 'graphite') {
        // Draw elegant glowing golden veins/cracks for Graphite Hermético
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 215, 127, 0.35)'; // Soft gold cracks
        ctx.lineWidth = 1;
        ctx.globalCompositeOperation = 'source-over';
        
        // Veta 1
        ctx.beginPath();
        ctx.moveTo(centerX - 25, centerY - 25);
        ctx.lineTo(centerX - 10, centerY - 15);
        ctx.lineTo(centerX + 5, centerY - 25);
        ctx.lineTo(centerX + 25, centerY - 10);
        ctx.stroke();

        // Veta 2
        ctx.beginPath();
        ctx.moveTo(centerX - 35, centerY + 15);
        ctx.lineTo(centerX - 15, centerY + 10);
        ctx.lineTo(centerX + 10, centerY + 25);
        ctx.stroke();

        ctx.restore();
      } else if (activeMaterial === 'bronze') {
        // Draw an ancient engraved circular seal representing a protective lock
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 29, 17, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        // Cross or internal oracle geometry
        ctx.beginPath();
        ctx.moveTo(centerX - baseRadius * 0.45, centerY);
        ctx.lineTo(centerX + baseRadius * 0.45, centerY);
        ctx.moveTo(centerX, centerY - baseRadius * 0.45);
        ctx.lineTo(centerX, centerY + baseRadius * 0.45);
        ctx.stroke();
        ctx.restore();
      } else if (activeMaterial === 'opal') {
        // Give a beautiful extra iridescent glass reflection on top
        const reflectionGrad = ctx.createLinearGradient(centerX - 50, centerY - 50, centerX + 50, centerY + 50);
        reflectionGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        reflectionGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
        reflectionGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
        
        ctx.save();
        ctx.fillStyle = reflectionGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Liquid gold organic glares
        ctx.beginPath();
        ctx.arc(centerX - baseRadius * 0.22, centerY - baseRadius * 0.22, baseRadius * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isThinking, isSpeaking, activeMaterial]);

  // Choose shadow colors based on material
  const shadowColorClass = (() => {
    switch (activeMaterial) {
      case 'graphite':
        return 'bg-zinc-700/5 shadow-[0_0_50px_rgba(39,39,42,0.15)]';
      case 'bronze':
        return 'bg-amber-800/5 shadow-[0_0_50px_rgba(205,127,50,0.15)]';
      case 'opal':
        return 'bg-pink-300/10 shadow-[0_0_60px_rgba(167,243,208,0.25)]';
      case 'gold_liquid':
      default:
        return 'bg-yellow-500/5 shadow-[0_0_50px_rgba(212,175,55,0.25)]';
    }
  })();

  const filterStyle = (() => {
    let shadowColor = 'rgba(212, 175, 55, 0.25)';
    if (activeMaterial === 'graphite') shadowColor = 'rgba(120, 113, 108, 0.12)';
    else if (activeMaterial === 'bronze') shadowColor = 'rgba(139, 92, 26, 0.22)';
    else if (activeMaterial === 'opal') shadowColor = 'rgba(244, 63, 94, 0.3)';

    const radius = isThinking ? '35px' : isSpeaking ? '25px' : '15px';
    return {
      filter: `drop-shadow(0 0 ${radius} ${shadowColor})`,
      transition: 'filter 0.5s ease-in-out'
    };
  })();

  return (
    <div className="relative flex items-center justify-center mx-auto">
      {/* Dynamic Ambient Blur Aura */}
      <div 
        className={`absolute inset-0 rounded-full filter blur-3xl transition-all duration-1000 ${shadowColorClass} ${
          isThinking ? 'scale-125 opacity-75' : isSpeaking ? 'scale-112 opacity-55' : 'scale-95 opacity-35'
        }`} 
      />
      
      <canvas 
        ref={canvasRef} 
        style={filterStyle}
        className="z-10 relative"
      />
    </div>
  );
}
