// The concept checkout: real cart contents, payment switched off, a call to action, and an optional
// link into Shopify's real checkout in test mode (development stores need the storefront password).
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export function mountCheckoutPanel(root, { cart, brand, bookingUrl, storePassword }) {
  const d = document.createElement('div');
  d.className = 'kit-panel';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-modal', 'true');
  d.setAttribute('aria-labelledby', 'kit-panel-title');
  d.hidden = true;
  root.appendChild(d);
  let opener = null;

  function render() {
    const lines = cart.lines();
    const t = cart.total();
    d.innerHTML = `
      <div class="kit-panel__box">
        <button type="button" class="kit-panel__close" aria-label="Close">×</button>
        <h2 id="kit-panel-title">Your ${esc(brand)} order</h2>
        <ul class="kit-panel__lines">${lines.map((l) => `
          <li><span class="kit-panel__t">${esc(l.title)}</span>
          <span class="kit-panel__o">${esc(Object.values(l.options).join(' · '))}${Object.keys(l.attrs).length ? ' · ' + esc(Object.entries(l.attrs).map(([k, v]) => `${k}: ${v}`).join(' · ')) : ''}</span>
          <span class="kit-panel__q">× ${l.qty}</span><span class="kit-panel__p">${money(l.price * l.qty, t.currencyCode)}</span></li>`).join('')}
        </ul>
        <p class="kit-panel__total"><span>Total</span><span>${money(t.amount, t.currencyCode)}</span></p>
        <p class="kit-panel__note">${esc(brand)} is a concept store built by JLB USA. This cart is live Shopify data. Payment is switched off.
        Want an experience like this for your store? Let's talk.</p>
        <a class="kit-panel__cta" href="${esc(bookingUrl)}" target="_blank" rel="noopener">Book a call</a>
        <div class="kit-panel__real">
          <button type="button" class="kit-panel__reveal">See Shopify's real checkout (test mode)</button>
        </div>
      </div>`;
    d.querySelector('.kit-panel__close').addEventListener('click', close);
    d.querySelector('.kit-panel__reveal').addEventListener('click', () => {
      const box = d.querySelector('.kit-panel__real');
      box.innerHTML = `<p>Shopify asks for the store password first. It is <code>${esc(storePassword)}</code>. Enter <code>1</code> as the card number. This is Shopify's test gateway. No money moves.</p>
        <a class="kit-panel__go" href="${esc(cart.checkoutUrl() || '#')}" target="_blank" rel="noopener">Open the test checkout</a>`;
      box.querySelector('a').focus();
    });
  }

  const focusables = () => [...d.querySelectorAll('a[href],button:not([disabled])')];
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    const first = f[0], last = f[f.length - 1];
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  });

  function open() {
    opener = document.activeElement;
    render();
    d.hidden = false;
    document.documentElement.classList.add('kit-panel-open');
    focusables()[0]?.focus();
  }
  function close() {
    d.hidden = true;
    document.documentElement.classList.remove('kit-panel-open');
    opener?.focus?.();
  }
  cart.subscribe(() => { if (!d.hidden) render(); });
  return { open, close };
}
