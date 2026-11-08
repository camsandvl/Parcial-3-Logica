import type { ReactNode } from 'react';

/** Burbuja de diálogo del personaje que guía cada escena. */
export function Guide({ name, children }: { name: 'Turing' | 'Gödel' | 'Tarski'; children: ReactNode }) {
  return (
    <aside className="guide">
      <div className="portrait" aria-hidden="true">{name[0]}</div>
      <div className="speech">
        <span className="guide-name">{name}</span>
        <p>{children}</p>
      </div>
    </aside>
  );
}
