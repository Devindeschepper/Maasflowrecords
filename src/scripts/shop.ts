import { addToCart } from './cart';

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
      addToCart(id, size, 1, Number(form.dataset.max) || 10);
      if (msg) msg.innerHTML = 'Added to cart — <a href="/cart/">view cart</a>';
    });
  });
}
