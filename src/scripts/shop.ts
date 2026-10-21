import { addToCart } from './cart';
import { here, tc } from '../i18n/client';

/** Wires up every `form[data-add-to-cart]` on the page. */
export function enhanceAddToCart() {
  document.querySelectorAll<HTMLFormElement>('form[data-add-to-cart]').forEach((form) => {
    const msg = form.querySelector<HTMLElement>('.added');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const id = String(data.get('id'));
      const size = data.get('size') ? String(data.get('size')) : undefined;
      // Products with stock per size carry the limit on the chosen size.
      const option = form.querySelector<HTMLSelectElement>('select[name="size"]')?.selectedOptions[0];
      addToCart(id, size, 1, Number(option?.dataset.max ?? form.dataset.max) || 10);
      if (msg) msg.innerHTML = tc().added(here('/cart/'));
    });
  });
}
