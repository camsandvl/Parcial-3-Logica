import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Botón «i» en la esquina superior derecha de cada escena: al hacer clic muestra una
 * nota de papel con un dato curioso sobre el lugar o la época de la escena.
 */
export function SceneInfo({ place, fact }: { place: string; fact: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="scene-info">
      <button type="button" className={`scene-info-btn ${open ? 'on' : ''}`} onClick={() => setOpen(!open)}
        aria-expanded={open} aria-label={open ? 'Cerrar dato curioso' : 'Ver dato curioso sobre este lugar'}>
        {open ? '×' : 'i'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="scene-info-note" role="note"
            initial={{ opacity: 0, y: -12, rotate: -6, scale: 0.9 }} animate={{ opacity: 1, y: 0, rotate: 1.5, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.9 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            <span className="scene-info-title">¿Dónde estamos? · {place}</span>
            <p>{fact}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
