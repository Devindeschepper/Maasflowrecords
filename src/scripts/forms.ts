// Progressive enhancement for forms marked `data-ajax`.
// Without JS the form posts normally and the server redirects to /thanks/.

declare global {
  interface Window { turnstile?: { reset: (el?: Element | string) => void } }
}

export function enhanceForms() {
  document.querySelectorAll<HTMLFormElement>('form[data-ajax]').forEach((form) => {
    if (form.dataset.enhanced) return; // several scripts may call enhanceForms()
    form.dataset.enhanced = 'true';
    const status = form.querySelector<HTMLElement>('.form-status');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const started = form.querySelector<HTMLInputElement>('input[name="_ts"]');
    if (started) started.value = String(Date.now());

    const setStatus = (msg: string, state: 'ok' | 'error' | '') => {
      if (!status) return;
      status.textContent = msg;
      status.dataset.state = state;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      const file = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
      const maxMb = Number(form.dataset.maxFileMb ?? 0);
      if (file && maxMb && file.size > maxMb * 1024 * 1024) {
        setStatus(`File is too large (max ${maxMb} MB). Share a link instead.`, 'error');
        return;
      }

      button?.setAttribute('disabled', '');
      setStatus('Sending…', '');
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        form.reset();
        if (started) started.value = String(Date.now());
        setStatus(form.dataset.success ?? 'Thanks - your message was sent.', 'ok');
      } catch (err) {
        setStatus(
          `${(err as Error).message} You can also email ${['info', 'maasflowrecords.com'].join('@')}.`,
          'error',
        );
      } finally {
        button?.removeAttribute('disabled');
        window.turnstile?.reset(form.querySelector('.cf-turnstile') ?? undefined);
      }
    });
  });
}
