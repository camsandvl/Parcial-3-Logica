import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Botón «i» en la esquina superior derecha de cada escena: al hacer clic se abre, como modal,
 * una nota de papel centrada con un dato curioso sobre el lugar o la época de la escena; el
 * fondo se oscurece. Cualquier clic fuera de la nota (o Esc) la cierra.
 */
/** Foto de época que acompaña al dato (opcional): se pega en la nota como una copia impresa. */
export interface InfoPhoto { src: string; alt: string; caption: string }

export function SceneInfo({ place, fact, photo }: { place: string; fact: string; photo?: InfoPhoto }) {
  const [open, setOpen] = useState(false);
  const note = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    // Clics fuera de la escena (p. ej. en el panel lateral) también la cierran
    const onDown = (e: PointerEvent) => { if (!note.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  return (
    <>
      <div className="scene-info">
        <button type="button" className="scene-info-btn" onClick={() => setOpen(true)}
          aria-haspopup="dialog" aria-label="Ver dato curioso sobre este lugar">
          i
        </button>
      </div>
      <AnimatePresence>
        {open && (
          // El fondo oscuro se traga el clic: cerrar la nota no avanza el diálogo de la escena
          <motion.div key="overlay" className="scene-info-overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.25 }}>
            <motion.div ref={note} className="scene-info-note" role="dialog" aria-modal="true" aria-label={`¿Dónde estamos? ${place}`}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.9, transition: { duration: 0.2 } }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
              <button type="button" className="scene-info-close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
              <span className="scene-info-title">¿Dónde estamos? · {place}</span>
              <div className={`scene-info-body ${photo ? 'has-photo' : ''}`}>
                {photo && (
                  <figure className="scene-info-photo">
                    <img src={photo.src} alt={photo.alt} draggable={false} />
                    <figcaption>{photo.caption}</figcaption>
                  </figure>
                )}
                <p>{fact}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
