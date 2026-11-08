import { useEffect, useState } from 'react';

interface Props {
  speaker: string;
  text: string;
  /** Si es false, el clic no avanza (p. ej. cuando el usuario debe jalar la palanca). */
  canAdvance: boolean;
  onAdvance: () => void;
  /** Avisa cuando el texto empieza o termina de escribirse (para animar al personaje). */
  onTypingChange?: (typing: boolean) => void;
}

const CHARS_PER_SECOND = 45;

/** Caja de diálogo con efecto de máquina de escribir.
 *  Clic, Enter o Espacio: si el texto aún se escribe, lo completa; si no, avanza. */
export function DialogBox({ speaker, text, canAdvance, onAdvance, onTypingChange }: Props) {
  const [shown, setShown] = useState(0);
  const done = shown >= text.length;

  useEffect(() => {
    onTypingChange?.(!done);
  }, [done, onTypingChange]);

  useEffect(() => {
    setShown(0);
    const id = setInterval(() => setShown((n) => (n >= text.length ? n : n + 1)), 1000 / CHARS_PER_SECOND);
    return () => clearInterval(id);
  }, [text]);

  const next = () => {
    if (!done) setShown(text.length);
    else if (canAdvance) onAdvance();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="vn-dialog" onClick={next} role="log" aria-live="polite">
      <div className="vn-nameplate">{speaker}</div>
      <p>{text.slice(0, shown)}</p>
      {done && canAdvance && <span className="vn-next" aria-hidden="true">▼</span>}
    </div>
  );
}
