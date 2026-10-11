// Small helpers for downloading and picking text files (schematics, mods, server packs).

/** Ask the player for a small text file. Resolves null if they cancel. */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.style.display = 'none';
    let done = false;
    const finish = (v: string | null) => { if (done) return; done = true; input.remove(); resolve(v); };
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f || f.size > 12_000_000) { finish(null); return; }
      const rd = new FileReader();
      rd.onload = () => finish(typeof rd.result === 'string' ? rd.result : null);
      rd.onerror = () => finish(null);
      rd.readAsText(f);
    };
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

/** Save text (or bytes) as a file the browser downloads. */
export function downloadFile(filename: string, data: string | Uint8Array, type = 'application/json') {
  const part = typeof data === 'string' ? data : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
  const url = URL.createObjectURL(new Blob([part], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const fileSafe = (n: string) => (n.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'file').slice(0, 40);
