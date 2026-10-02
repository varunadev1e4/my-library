import { useEffect, useState } from 'react';

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Average colour of the cover's left edge (where the spine would be)
const sample = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const w = 40, h = Math.max(1, Math.round((img.height * w) / img.width));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, Math.max(2, Math.round(w * 0.08)), h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      resolve(toHsl(r / n, g / n, b / n));
    } catch { resolve(null); }
  };
  img.onerror = () => resolve(null);
  img.src = url.replace('-L', '-M');
});

export function useSpineColors(books) {
  const [map, setMap] = useState(() => { try { return JSON.parse(localStorage.getItem('lib-spines') || '{}'); } catch { return {}; } });
  const key = books.map((b) => b.cover).join('|');
  useEffect(() => {
    let dead = false;
    const todo = [...new Set(books.map((b) => b.cover).filter((c) => c && !(c in map)))];
    if (!todo.length) return;
    (async () => {
      for (let i = 0; i < todo.length; i += 4) {
        const batch = todo.slice(i, i + 4);
        const res = await Promise.all(batch.map(sample));
        if (dead) return;
        setMap((m) => {
          const n = { ...m }; batch.forEach((u, j) => { n[u] = res[j]; });
          try { localStorage.setItem('lib-spines', JSON.stringify(n)); } catch {}
          return n;
        });
      }
    })();
    return () => { dead = true; };
  }, [key]);
  return map;
}
