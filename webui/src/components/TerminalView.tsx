import { useEffect, useRef } from 'react';
import type { Session } from '@/stores/sessionStore';

interface Props {
  session: Session;
  isActive: boolean;
  onResize: (sessionId: string, cols: number, rows: number) => void;
}

export function TerminalView({ session, isActive, onResize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // Mount terminal into DOM
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mountedRef.current) return;
    mountedRef.current = true;

    session.term.open(el);
    session.fitAddon.fit();

    // Send initial size
    const dims = session.fitAddon.proposeDimensions();
    if (dims) {
      onResize(session.id, dims.cols, dims.rows);
    }
  }, [session, onResize]);

  // Fit + focus when becoming active
  useEffect(() => {
    if (isActive && mountedRef.current) {
      // Small delay to ensure the DOM has updated visibility
      requestAnimationFrame(() => {
        session.fitAddon.fit();
        session.term.focus();
      });
    }
  }, [isActive, session]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (!isActive) return;
      session.fitAddon.fit();
      const dims = session.fitAddon.proposeDimensions();
      if (dims) {
        onResize(session.id, dims.cols, dims.rows);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [session, isActive, onResize]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-1 ${isActive ? 'block' : 'hidden'}`}
    />
  );
}
