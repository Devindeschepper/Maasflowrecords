// Client-side cart, stored in localStorage. Only product ids, sizes and
// quantities are stored — prices are always recalculated from products.ts
// (in the browser for display, and again on the server at checkout).

export interface CartLine {
  id: string;
  size?: string;
  qty: number;
}

const KEY = 'mfr-cart-v1';
const EVENT = 'mfr:cart';

const safeRead = (): CartLine[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.id === 'string' && Number.isInteger(l.qty) && l.qty > 0)
      : [];
  } catch {
    return [];
  }
};

let memory: CartLine[] | null = null;

export const getCart = (): CartLine[] => (memory ??= safeRead());

const save = (lines: CartLine[]) => {
  memory = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable (private mode) — cart lives in memory for this page */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
};

const same = (a: CartLine, id: string, size?: string) => a.id === id && (a.size ?? '') === (size ?? '');

export const addToCart = (id: string, size?: string, qty = 1, max = 10) => {
  const lines = [...getCart()];
  const line = lines.find((l) => same(l, id, size));
  if (line) line.qty = Math.min(max, line.qty + qty);
  else lines.push({ id, size, qty: Math.min(max, qty) });
  save(lines);
};

export const setQty = (id: string, size: string | undefined, qty: number, max = 10) => {
  const lines = getCart()
    .map((l) => (same(l, id, size) ? { ...l, qty: Math.max(0, Math.min(max, qty)) } : l))
    .filter((l) => l.qty > 0);
  save(lines);
};

export const clearCart = () => save([]);

export const cartCount = () => getCart().reduce((n, l) => n + l.qty, 0);

export const onCartChange = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  // keep multiple tabs in sync
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      memory = null;
      fn();
    }
  });
};
