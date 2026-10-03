import { useEffect, useRef, useState } from 'react';

// In-page replacements for the browser's prompt() and confirm(), which break when pop-ups are blocked.
// Usage: const name = await askText({ title, label, initial });   const ok = await askConfirm({ title, message, danger });
let push = null;
const open = (o) => new Promise((resolve) => { if (push) push({ ...o, resolve }); else resolve(o.kind === 'confirm' ? false : null); });
export const askText = (o) => open({ ...o, kind: 'text' });
export const askConfirm = (o) => open({ ...o, kind: 'confirm' });

export default function DialogHost() {
  const [queue, setQueue] = useState([]);
  const [val, setVal] = useState('');
  const cur = queue[0];
  const back = useRef(null), inputRef = useRef(null), okRef = useRef(null), cancelRef = useRef(null);

  useEffect(() => { push = (d) => setQueue((q) => [...q, d]); return () => { push = null; }; }, []);
  useEffect(() => {
    if (!cur) return;
    back.current = document.activeElement; setVal(cur.initial ?? '');
    const t = setTimeout(() => { const el = cur.kind === 'text' ? inputRef.current : cur.danger ? cancelRef.current : okRef.current; el?.focus(); el?.select?.(); }, 30);
    return () => clearTimeout(t);
  }, [cur]);

  const cancelValue = cur?.kind === 'confirm' ? false : null;
  const finish = (v) => { cur.resolve(v); setQueue((q) => q.slice(1)); setTimeout(() => back.current?.focus?.(), 0); };

  useEffect(() => {
    if (!cur) return;
    // Capture phase + stopPropagation, so Escape closes only this dialog and not the window behind it
    const k = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(cancelValue); } };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, [cur]);

  if (!cur) return null;
  const submit = (e) => {
    e.preventDefault();
    if (cur.kind === 'confirm') return finish(true);
    const v = val.trim(); if (!v && cur.required !== false) return;
    finish(v);
  };
  return (
    <div className="modal top" onClick={() => finish(cancelValue)}>
      <form className="dialog small" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 id="dlg-title" className="display">{cur.title}</h2>
        {cur.message && <p className="dlg-msg">{cur.message}</p>}
        {cur.kind === 'text' && (
          <label className="ef"><span>{cur.label}</span>
            <input ref={inputRef} type={cur.type || 'text'} inputMode={cur.type === 'number' ? 'numeric' : undefined} min={cur.min} value={val} placeholder={cur.placeholder} onChange={(e) => setVal(e.target.value)} />
          </label>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn" ref={cancelRef} onClick={() => finish(cancelValue)}>Cancel</button>
          <button type="submit" ref={okRef} className={`btn ${cur.danger ? 'danger solid' : 'primary'}`}>{cur.confirmLabel || 'OK'}</button>
        </div>
      </form>
    </div>
  );
}
