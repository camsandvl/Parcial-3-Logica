/**
 * Descarga y decodifica imágenes en segundo plano, para que la escena siguiente
 * aparezca completa y sin tirones (las imágenes de personajes y fondos son grandes).
 */
export function preloadImages(urls: string[]) {
  for (const url of urls) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img.decode?.().catch(() => { /* si falla, la escena la cargará normalmente */ });
  }
}
