const SUPABASE_URL = 'https://sawxgllonwjjbmuaddyd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PETx6WMwU5PGKzKZKQJQwgw_P5WUw_i4';
const CHECKOUT_URL = `${SUPABASE_URL}/functions/v1/shop-checkout`;

const grid = document.querySelector('#product-grid');
const catalogMessage = document.querySelector('#catalog-message');
const countLabel = document.querySelector('#product-count');
const cartItems = document.querySelector('#cart-items');
const totalLabel = document.querySelector('#cart-total');
const nickInput = document.querySelector('#minecraft-nick');
const checkoutButton = document.querySelector('#checkout-button');
const checkoutMessage = document.querySelector('#checkout-message');
const cart = new Map();
let products = [];

document.querySelector('#year').textContent = new Date().getFullYear();
checkoutButton.addEventListener('click', checkout);
nickInput.addEventListener('input', () => {
  nickInput.setCustomValidity('');
  checkoutMessage.hidden = true;
});

loadProducts();

async function loadProducts() {
  try {
    let { response, data } = await requestProducts('is_active');
    // Support schemas that name the activation flag `active` instead.
    if (!response.ok && response.status === 400) ({ response, data } = await requestProducts('active'));
    if (!response.ok) throw new Error(readError(data, 'Nie udało się pobrać oferty.'));
    if (!Array.isArray(data)) throw new Error('Otrzymaliśmy nieprawidłowe dane oferty.');

    products = data.filter(isActive).sort((a, b) => number(a.sort_order) - number(b.sort_order));
    if (!products.length) {
      catalogMessage.textContent = 'Oferta jest teraz aktualizowana. Wróć za chwilę.';
      return;
    }
    catalogMessage.textContent = '';
    countLabel.textContent = `${products.length} ${plural(products.length, 'produkt', 'produkty', 'produktów')}`;
    products.forEach((product, index) => grid.append(renderProduct(product, index)));
  } catch (error) {
    catalogMessage.classList.add('error');
    catalogMessage.textContent = `${error.message} Odśwież stronę za chwilę lub skontaktuj się z administracją.`;
  }
}

async function requestProducts(activeColumn) {
  const url = `${SUPABASE_URL}/rest/v1/shop_products?select=*&${activeColumn}=eq.true&order=sort_order.asc`;
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

function isActive(product) {
  return product.is_active === true || product.active === true;
}

function renderProduct(product, index) {
  const id = product.id ?? product.product_id;
  const name = String(product.name ?? product.title ?? 'Produkt FlootMC');
  const description = String(product.description ?? product.short_description ?? 'Dodatek do gry na serwerze FlootMC.');
  const price = number(product.price ?? product.price_pln ?? product.amount);
  const card = document.createElement('article');
  card.className = 'product-card';
  card.style.animationDelay = `${Math.min(index * 45, 360)}ms`;

  const art = document.createElement('div');
  art.className = 'product-art';
  const imageUrl = safeImageUrl(product.image_url ?? product.image ?? product.icon_url);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { image.remove(); art.append(makeMark(name)); };
    art.append(image);
  } else art.append(makeMark(name));

  const info = document.createElement('div');
  info.className = 'product-info';
  const title = document.createElement('h3');
  title.textContent = name;
  const desc = document.createElement('p');
  desc.className = 'product-description';
  desc.textContent = description;
  const bottom = document.createElement('div');
  bottom.className = 'product-bottom';
  const priceLabel = document.createElement('span');
  priceLabel.className = 'product-price';
  priceLabel.textContent = formatPrice(price);
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-button';
  add.textContent = 'Dodaj do koszyka';
  add.disabled = id == null || !Number.isFinite(price) || price < 0;
  add.addEventListener('click', () => addToCart(String(id), add));
  bottom.append(priceLabel, add);
  info.append(title, desc, bottom);
  card.append(art, info);
  return card;
}

function makeMark(name) {
  const mark = document.createElement('span');
  mark.className = 'art-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = name.trim().slice(0, 1).toUpperCase() || '✦';
  return mark;
}

function addToCart(id, button) {
  const product = products.find((item) => String(item.id ?? item.product_id) === id);
  if (!product) return;
  const current = cart.get(id);
  cart.set(id, { product, quantity: Math.min((current?.quantity ?? 0) + 1, 99) });
  button.textContent = 'Dodano ✓';
  window.setTimeout(() => { button.textContent = 'Dodaj do koszyka'; }, 1000);
  checkoutMessage.hidden = true;
  renderCart();
}

function changeQuantity(id, amount) {
  const entry = cart.get(id);
  if (!entry) return;
  const quantity = entry.quantity + amount;
  if (quantity <= 0) cart.delete(id);
  else entry.quantity = Math.min(quantity, 99);
  renderCart();
}

function renderCart() {
  cartItems.replaceChildren();
  if (!cart.size) {
    const empty = document.createElement('p');
    empty.className = 'empty-cart';
    empty.textContent = 'Wybierz produkt, aby dodać go do zamówienia.';
    cartItems.append(empty);
  }
  let total = 0;
  for (const [id, { product, quantity }] of cart) {
    const name = String(product.name ?? product.title ?? 'Produkt');
    const price = number(product.price ?? product.price_pln ?? product.amount);
    total += price * quantity;
    const row = document.createElement('div');
    row.className = 'cart-row';
    const title = document.createElement('span');
    title.className = 'cart-name';
    title.textContent = name;
    const controls = document.createElement('div');
    controls.className = 'cart-controls';
    controls.append(quantityButton('−', `Zmniejsz ilość produktu ${name}`, () => changeQuantity(id, -1)));
    const count = document.createElement('span');
    count.textContent = String(quantity);
    controls.append(count, quantityButton('+', `Zwiększ ilość produktu ${name}`, () => changeQuantity(id, 1)));
    row.append(title, controls);
    cartItems.append(row);
  }
  totalLabel.textContent = formatPrice(total);
  checkoutButton.disabled = cart.size === 0;
}

function quantityButton(label, ariaLabel, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quantity-button';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', action);
  return button;
}

async function checkout() {
  checkoutMessage.hidden = true;
  nickInput.setCustomValidity('');
  const nick = nickInput.value.trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
    nickInput.setCustomValidity('Nick musi mieć od 3 do 16 znaków: litery, cyfry lub podkreślenie.');
    nickInput.reportValidity();
    return;
  }
  if (!cart.size) return;

  checkoutButton.disabled = true;
  checkoutButton.classList.add('loading');
  checkoutButton.querySelector('span').textContent = 'Przygotowuję płatność…';
  try {
    const response = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({
        player_name: nick,
        items: [...cart].map(([product_id, entry]) => ({ product_id, quantity: entry.quantity }))
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(readError(data, 'Nie udało się utworzyć zamówienia. Spróbuj ponownie.'));
    const paymentUrl = data?.payment_url ?? data?.paymentUrl ?? data?.url ?? data?.redirect_url ?? data?.redirectUrl;
    if (typeof paymentUrl !== 'string') throw new Error(readError(data, 'Zamówienie nie zwróciło adresu płatności. Skontaktuj się z administracją.'));
    const url = new URL(paymentUrl);
    if (url.protocol !== 'https:') throw new Error('Otrzymaliśmy nieprawidłowy adres płatności. Skontaktuj się z administracją.');
    window.location.assign(url.href);
  } catch (error) {
    showCheckoutError(error.message || 'Wystąpił problem z połączeniem. Sprawdź internet i spróbuj ponownie.');
  } finally {
    checkoutButton.classList.remove('loading');
    checkoutButton.querySelector('span').textContent = 'Przejdź do płatności';
    checkoutButton.disabled = cart.size === 0;
  }
}

function showCheckoutError(message) {
  checkoutMessage.textContent = message;
  checkoutMessage.hidden = false;
}

function readError(data, fallback) {
  const value = data?.error ?? data?.message ?? data?.details;
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function safeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function formatPrice(value) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
}

function plural(value, one, few, many) {
  if (value === 1) return one;
  return value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 12 || value % 100 > 14) ? few : many;
}
