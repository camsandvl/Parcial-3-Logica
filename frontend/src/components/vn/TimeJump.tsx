import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Salto en el tiempo entre escenas: el remolino crece girando hasta tapar el escenario, en el
 * centro aparece la hoja de calendario y su año rueda como un contador (2026 → 1941), y el
 * remolino se encoge para mostrar la escena nueva. Dura ~1.8 s y tapa el fundido de las escenas.
 * Un clic o una tecla lo saltan: se desvanece en 0.2 s.
 */
export const JUMP_MS = 1800;
const SKIP_MS = 200;
/** Momento en que el remolino ya tapa toda la pantalla: ahí se cambia la escena por debajo. */
export const COVER_MS = Math.round(JUMP_MS * 0.3);

/** Año de cada ruta. Solo se salta cuando el año cambia (la portada no tiene año). */
export const ROUTE_YEARS: Record<string, number> = {
  '/salon': 2026,
  '/turing': 1941,
  '/activacion': 1941,
  '/lenguaje': 1931,
  '/universo': 1933,
  '/consola': 1948,
  '/informe': 1948, // mismo año que la consola: el informe sale de ella, no hay salto
  '/examen': 2026,
};

const T = JUMP_MS / 1000;
const DIGITS = '0123456789'.split('');
/** Alto de cada cifra en la tira (em). Igual al alto de la hoja: las cifras entran y salen por
 *  los bordes del papel (arriba, por debajo de la franja roja), nunca se cortan a media hoja. */
const CELL = 1.4;

/** Una cifra del contador: una tira de 0 a 9 que se desliza de la cifra vieja a la nueva. */
function Digit({ from, to, index }: { from: string; to: string; index: number }) {
  return (
    <span className="time-jump-digit">
      <motion.span className="time-jump-strip"
        initial={{ y: `${-Number(from) * CELL}em` }} animate={{ y: `${-Number(to) * CELL}em` }}
        // las cifras de la derecha ruedan un poco después, como un odómetro
        transition={{ delay: T * 0.2 + index * 0.07, duration: T * 0.3, ease: [0.3, 0, 0.2, 1] }}>
        {DIGITS.map((d) => <span key={d}>{d}</span>)}
      </motion.span>
    </span>
  );
}

export function TimeJump({ from, to, onSkip, onDone }: { from: number; to: number; onSkip: () => void; onDone: () => void }) {
  const [skipped, setSkipped] = useState(false);
  // al saltarlo, la escena nueva se pone ya debajo, para que el desvanecido la muestre a ella
  const skip = () => { onSkip(); setSkipped(true); };
  useEffect(() => {
    const id = setTimeout(onDone, skipped ? SKIP_MS : JUMP_MS);
    return () => clearTimeout(id);
  }, [onDone, skipped]);

  // Cualquier tecla también lo salta (y no llega a la escena: no avanza su diálogo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); skip(); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const a = String(from).padStart(4, '0');
  const b = String(to).padStart(4, '0');
  const times = [0, 0.28, 0.78, 1];

  return (
    <motion.div className="time-jump" aria-live="polite" aria-label={`Saltando de ${from} a ${to}`} title="Clic para saltar"
      onPointerDown={(e) => { e.stopPropagation(); skip(); }}
      animate={{ opacity: skipped ? 0 : 1 }} transition={{ duration: SKIP_MS / 1000 }}>
      {/* destello lavanda: tapa el cambio de escena mientras el remolino está grande */}
      <motion.div className="time-jump-flash"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: T, times, ease: 'easeInOut' }} />
      <motion.img className="time-jump-swirl" src="/assets/fx/time-swirl.webp" alt="" draggable={false}
        initial={{ scale: 0, rotate: 0, opacity: 0 }}
        animate={{ scale: [0, 1, 1.08, 0], rotate: [0, 300, 420, 720], opacity: [0, 1, 1, 0] }}
        transition={{ duration: T, times, ease: 'easeInOut' }} />
      <motion.div className="time-jump-card"
        initial={{ opacity: 0, scale: 0.5, rotate: -12 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.7], rotate: [-12, -3, -3, 6] }}
        transition={{ duration: T, times: [0, 0.2, 0.84, 1], ease: 'easeInOut' }}>
        <span className="time-jump-year">
          {b.split('').map((d, i) => <Digit key={i} from={a[i]} to={d} index={i} />)}
        </span>
      </motion.div>
    </motion.div>
  );
}
