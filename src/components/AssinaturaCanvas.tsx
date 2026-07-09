'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface AssinaturaCanvasHandle {
  limpar: () => void;
  estaVazio: () => boolean;
  paraDataUrl: () => string | null;
}

interface AssinaturaCanvasProps {
  className?: string;
}

// Canvas simples de assinatura, feito à mão (sem lib externa): captura
// pointer events (mouse, caneta e touch — funciona em tablets) e desenha um
// traço contínuo. Exposto via ref para o componente pai ler/limpar.
const AssinaturaCanvas = forwardRef<AssinaturaCanvasHandle, AssinaturaCanvasProps>(
  function AssinaturaCanvas({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const desenhandoRef = useRef(false);
    const temTracoRef = useRef(false);

    const getContext = () => canvasRef.current?.getContext('2d') || null;

    const posicaoRelativa = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const ctx = getContext();
      if (!ctx) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      desenhandoRef.current = true;
      const { x, y } = posicaoRelativa(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!desenhandoRef.current) return;
      const ctx = getContext();
      if (!ctx) return;
      const { x, y } = posicaoRelativa(e);
      ctx.lineTo(x, y);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();
      temTracoRef.current = true;
    };

    const onPointerUp = () => {
      desenhandoRef.current = false;
    };

    useImperativeHandle(ref, () => ({
      limpar: () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        temTracoRef.current = false;
      },
      estaVazio: () => !temTracoRef.current,
      paraDataUrl: () => (temTracoRef.current ? canvasRef.current?.toDataURL('image/png') || null : null),
    }));

    return (
      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className={className || 'w-full h-full touch-none bg-white rounded-xl border-2 border-dashed border-slate-300'}
        aria-label="Área de assinatura"
      />
    );
  }
);

export default AssinaturaCanvas;
