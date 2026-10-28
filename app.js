// Storefront behaviour: product grid, filters, product modal, cart drawer, WhatsApp ordering and toast.
// Reads the PRODUCTS catalogue from products.js.

const STORE_NAME = "Fakhir Outwears";
// Orders are sent here: country code + number, digits only (wa.me format).
const WHATSAPP_NUMBER = "923234123244";
// Products shown in the hero, by id. Falls back to the first products with photos.
const HERO_PRODUCT_IDS = ["copper-python-bomber", "navy-python-bomber"];
const MAX_QTY = 10;
const CART_STORAGE_KEY = "fakhir-cart";

const money = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });

const WHATSAPP_ICON = `<svg class="wa-glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
  <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9.2 7.8c-.3 0-.7.1-.9.5-.3.4-.8 1-.8 2.2s.9 2.4 1 2.6c.1.2 1.7 2.7 4.2 3.7 2.1.8 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3l-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2-1.3-.8-.7-1.3-1.5-1.4-1.8-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4h-.3Z" fill="currentColor"/>
</svg>`;

const $ = (selector, root = document) => root.querySelector(selector);

const els = {
  heroArt: $("#hero-art"),
  grid: $("#product-grid"),
  resultCount: $("#result-count"),
  emptyState: $("#empty-state"),
  search: $("#search"),
  sort: $("#sort"),
  chips: document.querySelectorAll(".chip"),
  categoryLinks: document.querySelectorAll("[data-nav-category]"),
  navLinks: document.querySelectorAll(".main-nav [data-nav-category]"),
  modal: $("#product-modal"),
  modalBody: $("#modal-body"),
  modalClose: $("#modal-close"),
  cartOpen: $("#cart-open"),
  cartClose: $("#cart-close"),
  cartCount: $("#cart-count"),
  drawer: $("#cart-drawer"),
  backdrop: $("#drawer-backdrop"),
  cartItems: $("#cart-items"),
  subtotal: $("#cart-subtotal"),
  checkout: $("#checkout"),
  toast: $("#toast"),
};

const state = {
  category: "all",
  query: "",
  sort: "featured",
  cardColors: {}, // product id -> selected colour index
  modal: null, // { product, colorIndex, size, qty } while the dialog is open
  cart: loadCart(), // [{ key, id, color, size, qty }]
};

// ---------- Helpers ----------

function escapeHTML(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (char) => entities[char]);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function findProduct(id) {
  return PRODUCTS.find((product) => product.id === id);
}

function currentPrice(product) {
  return product.salePrice ?? product.price;
}

function defaultSize(product) {
  return product.sizes.includes("M") ? "M" : product.sizes[Math.floor(product.sizes.length / 2)];
}

function cartKey(id, color, size) {
  return `${id}|${color}|${size}`;
}

function markActive(buttons, activeIndex) {
  buttons.forEach((button, index) => {
    button.classList.toggle("is-active", index === activeIndex);
    button.setAttribute("aria-pressed", String(index === activeIndex));
  });
}

// ---------- Illustrations ----------

// Shading is translucent black layered over the garment colour, so any hex works.
const OUTLINE = 'stroke="rgba(0,0,0,0.22)" stroke-width="1.5" stroke-linejoin="round"';

function shade(d, opacity) {
  return `<path d="${d}" fill="#000" opacity="${opacity}"/>`;
}

function jacketShapes(color) {
  const leftSleeve = "M62 38 L40 48 Q30 60 26 90 L16 158 L40 162 L52 100 Z";
  const rightSleeve = "M138 38 L160 48 Q170 60 174 90 L184 158 L160 162 L148 100 Z";
  const body = "M62 38 L82 30 Q100 40 118 30 L138 38 L148 100 L150 176 Q100 184 50 176 L52 100 Z";
  const collar = "M82 30 Q100 22 118 30 L116 40 Q100 48 84 40 Z";
  return `
    <path d="${leftSleeve}" fill="${color}" ${OUTLINE}/>
    <path d="${rightSleeve}" fill="${color}" ${OUTLINE}/>
    ${shade(leftSleeve, 0.08)}
    ${shade(rightSleeve, 0.08)}
    ${shade("M17.2 150 L41.5 154 L40 162 L16 158 Z", 0.16)}
    ${shade("M182.8 150 L158.5 154 L160 162 L184 158 Z", 0.16)}
    <path d="${body}" fill="${color}" ${OUTLINE}/>
    ${shade("M50.4 166 Q100 174 149.6 166 L150 176 Q100 184 50 176 Z", 0.16)}
    <path d="M70 52 Q65 100 67 160" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="6" stroke-linecap="round"/>
    <path d="M66 124 L76 148 M134 124 L124 148" stroke="rgba(0,0,0,0.3)" stroke-width="2" stroke-linecap="round"/>
    <path d="M100 44 V180" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>
    <rect x="97.5" y="48" width="5" height="10" rx="1.5" fill="rgba(0,0,0,0.45)"/>
    <path d="${collar}" fill="${color}" ${OUTLINE}/>
    ${shade(collar, 0.14)}`;
}

function tracksuitShapes(color, stripe) {
  const pants = "M66 104 L134 104 L140 194 L108 194 L100 132 L92 194 L60 194 Z";
  const leftSleeve = "M70 18 L54 24 Q46 32 43 50 L36 92 L52 94 L60 58 Z";
  const rightSleeve = "M130 18 L146 24 Q154 32 157 50 L164 92 L148 94 L140 58 Z";
  const top = "M70 18 L86 12 Q100 18 114 12 L130 18 L140 58 L140 98 Q100 104 60 98 L60 58 Z";
  const collar = "M86 12 Q100 6 114 12 L112 19 Q100 25 88 19 Z";
  const stripeAttrs = `fill="none" stroke="${stripe}" stroke-width="4" stroke-linecap="round"`;
  return `
    <path d="${pants}" fill="${color}" ${OUTLINE}/>
    ${shade("M66 104 L134 104 L134.5 111 L65.5 111 Z", 0.16)}
    <path d="M68.5 112 L63.5 191 M131.5 112 L136.5 191" ${stripeAttrs}/>
    <path d="M96 111 L94 120 M104 111 L106 120" stroke="${stripe}" stroke-width="1.5" stroke-linecap="round"/>
    ${shade("M60.5 186 L93 186 L92 194 L60 194 Z", 0.16)}
    ${shade("M139.5 186 L107 186 L108 194 L140 194 Z", 0.16)}
    <path d="${leftSleeve}" fill="${color}" ${OUTLINE}/>
    <path d="${rightSleeve}" fill="${color}" ${OUTLINE}/>
    ${shade(leftSleeve, 0.08)}
    ${shade(rightSleeve, 0.08)}
    <path d="M57 26 Q50 34 47 51 L41 91 M143 26 Q150 34 153 51 L159 91" ${stripeAttrs}/>
    ${shade("M37 86 L53.3 88 L52 94 L36 92 Z", 0.16)}
    ${shade("M163 86 L146.7 88 L148 94 L164 92 Z", 0.16)}
    <path d="${top}" fill="${color}" ${OUTLINE}/>
    ${shade("M60 92 Q100 98 140 92 L140 98 Q100 104 60 98 Z", 0.16)}
    <path d="M100 22 V101" stroke="rgba(0,0,0,0.35)" stroke-width="2"/>
    <rect x="97.5" y="24" width="5" height="9" rx="1.5" fill="rgba(0,0,0,0.45)"/>
    <path d="${collar}" fill="${color}" ${OUTLINE}/>
    ${shade(collar, 0.14)}`;
}

function garmentSVG(product, color) {
  const shapes = product.type === "tracksuit"
    ? tracksuitShapes(color, product.stripe || "#ffffff")
    : jacketShapes(color);
  return `<svg class="garment" viewBox="0 0 200 200" aria-hidden="true">${shapes}</svg>`;
}

// The product photo when there is one, otherwise the drawn illustration.
function productArt(product, color, { alt = "", lazy = false } = {}) {
  if (!product.image) return garmentSVG(product, color);
  return `<img class="product-photo" src="${escapeHTML(product.image)}" alt="${escapeHTML(alt)}"
    width="900" height="1200"${lazy ? ' loading="lazy"' : ""}>`;
}

function photoClass(product) {
  return product.image ? " has-photo" : "";
}

function renderHero() {
  const withPhotos = PRODUCTS.filter((product) => product.image);
  const picks = HERO_PRODUCT_IDS.map(findProduct).filter((product) => product && product.image);
  const shown = (picks.length === 2 ? picks : withPhotos.slice(0, 2));
  if (shown.length) {
    els.heroArt.innerHTML = `
      <div class="hero-photos">
        ${shown.map((product) => productArt(product, product.colors[0][1])).join("")}
      </div>`;
    return;
  }
  els.heroArt.innerHTML = `
    <svg viewBox="0 0 400 360" aria-hidden="true">
      <circle cx="205" cy="180" r="150" fill="#f1dccd"/>
      <circle cx="338" cy="62" r="22" fill="#d2552d" opacity="0.85"/>
      <ellipse cx="205" cy="330" rx="150" ry="10" fill="rgba(0,0,0,0.08)"/>
      <g transform="translate(136 30) scale(1.5)">${tracksuitShapes("#22314f", "#ffffff")}</g>
      <g transform="translate(-11 71) scale(1.3) rotate(-6 100 100)">${jacketShapes("#c8432f")}</g>
    </svg>`;
}

// ---------- Product markup ----------

function badgeHTML(product) {
  if (!product.tag) return "";
  return `<span class="badge badge-${product.tag.toLowerCase()}">${escapeHTML(product.tag)}</span>`;
}

function priceHTML(product) {
  if (product.salePrice == null) {
    return `<p class="price"><span class="price-now">${money.format(product.price)}</span></p>`;
  }
  return `
    <p class="price is-sale">
      <span class="price-now">${money.format(product.salePrice)}</span>
      <s class="price-was"><span class="sr-only">Was </span>${money.format(product.price)}</s>
    </p>`;
}

function ratingHTML(product) {
  if (product.rating == null) return "";
  return `
    <div class="rating" role="img" aria-label="Rated ${product.rating} out of 5 from ${product.reviews} reviews">
      <span class="stars" style="--rating: ${product.rating}"></span>
      <span class="rating-value">${product.rating.toFixed(1)}</span>
      <span class="rating-count">(${product.reviews})</span>
    </div>`;
}

function swatchesHTML(product, selected) {
  return product.colors.map(([name, hex], index) => `
    <button class="swatch${index === selected ? " is-active" : ""}" type="button" data-color="${index}"
      style="--swatch: ${hex}" title="${escapeHTML(name)}" aria-label="${escapeHTML(name)}"
      aria-pressed="${index === selected}"></button>`).join("");
}

function cardHTML(product) {
  const colorIndex = state.cardColors[product.id] ?? 0;
  const name = escapeHTML(product.name);
  const swatches = product.colors.length > 1
    ? `<div class="swatches" role="group" aria-label="Colour">${swatchesHTML(product, colorIndex)}</div>`
    : "";
  return `
    <article class="card" data-id="${product.id}">
      <button class="card-media${photoClass(product)}" type="button" data-action="open" aria-label="View ${name}">
        ${badgeHTML(product)}
        <span class="card-art">${productArt(product, product.colors[colorIndex][1], { lazy: true })}</span>
      </button>
      <div class="card-body">
        <h3 class="card-title"><button class="card-link" type="button" data-action="open">${name}</button></h3>
        ${priceHTML(product)}
        ${ratingHTML(product)}
        ${swatches}
        <p class="card-sizes">Sizes: ${product.sizes.map(escapeHTML).join(" · ")}</p>
        <button class="btn btn-outline btn-sm btn-block" type="button" data-action="quick-add">Quick add<span class="sr-only"> ${name}</span></button>
      </div>
    </article>`;
}

// ---------- Grid, filters and sorting ----------

const SORTERS = {
  "price-asc": (a, b) => currentPrice(a) - currentPrice(b),
  "price-desc": (a, b) => currentPrice(b) - currentPrice(a),
};

function visibleProducts() {
  const query = state.query.toLowerCase();
  const products = PRODUCTS.filter((product) => {
    if (state.category === "sale" && product.salePrice == null) return false;
    if (!["all", "sale"].includes(state.category) && product.category !== state.category) return false;
    return !query
      || product.name.toLowerCase().includes(query)
      || product.description.toLowerCase().includes(query);
  });
  // "featured" keeps catalogue order; filter() already returned a copy, so sorting is safe.
  return SORTERS[state.sort] ? products.sort(SORTERS[state.sort]) : products;
}

function renderGrid() {
  const products = visibleProducts();
  els.grid.innerHTML = products.map(cardHTML).join("");
  els.resultCount.textContent = `${products.length} ${products.length === 1 ? "product" : "products"}`;
  els.emptyState.hidden = products.length > 0;
}

function setCategory(category) {
  state.category = category;
  els.chips.forEach((chip) => {
    const active = chip.dataset.category === category;
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-selected", String(active));
  });
  els.navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.navCategory === category));
  renderGrid();
}

function setCardColor(productId, colorIndex) {
  state.cardColors[productId] = colorIndex;
  const card = Array.from(els.grid.children).find((el) => el.dataset.id === productId);
  if (!card) return;
  const product = findProduct(productId);
  $(".card-art", card).innerHTML = productArt(product, product.colors[colorIndex][1]);
  markActive(card.querySelectorAll(".swatch"), colorIndex);
}

// Hides category chips and links that have no products, e.g. Sale when nothing is discounted.
function hideEmptyCategories() {
  const hasProducts = (category) => category === "all"
    || PRODUCTS.some((product) => (category === "sale" ? product.salePrice != null : product.category === category));
  els.chips.forEach((chip) => {
    chip.hidden = !hasProducts(chip.dataset.category);
  });
  els.categoryLinks.forEach((link) => {
    link.hidden = !hasProducts(link.dataset.navCategory);
  });
}

// ---------- Product modal ----------

function modalHTML(product) {
  const sizes = product.sizes
    .map((size) => `<button class="size-btn" type="button" data-size="${size}">${size}</button>`)
    .join("");
  const swatches = product.colors.length > 1
    ? `<div class="swatches swatches-lg" role="group" aria-label="Colour">${swatchesHTML(product, -1)}</div>`
    : "";
  return `
    <div class="modal-art${photoClass(product)}"></div>
    <div class="modal-info">
      ${badgeHTML(product)}
      <h2 class="modal-title" id="modal-title">${escapeHTML(product.name)}</h2>
      ${ratingHTML(product)}
      ${priceHTML(product)}
      <p class="modal-desc">${escapeHTML(product.description)}</p>
      <div class="option-group">
        <p class="option-label">Colour: <span class="option-color"></span></p>
        ${swatches}
      </div>
      <div class="option-group">
        <p class="option-label">Size</p>
        <div class="sizes" role="group" aria-label="Size">${sizes}</div>
      </div>
      <div class="modal-actions">
        <div class="qty" role="group" aria-label="Quantity">
          <button type="button" data-qty="-1" aria-label="Decrease quantity">&minus;</button>
          <span class="qty-value" aria-live="polite"></span>
          <button type="button" data-qty="1" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn btn-primary modal-add" type="button"></button>
      </div>
      <button class="btn btn-whatsapp btn-block modal-whatsapp" type="button">${WHATSAPP_ICON}Order now on WhatsApp</button>
    </div>`;
}

// Syncs the open modal's dynamic parts with state.modal.
function updateModal() {
  const { product, colorIndex, size, qty } = state.modal;
  const [colorName, hex] = product.colors[colorIndex];
  const body = els.modalBody;
  const art = $(".modal-art", body);
  // Only redraw the art when the colour changes, so photos don't flicker on size or quantity clicks.
  if (art.dataset.color !== String(colorIndex)) {
    art.dataset.color = colorIndex;
    art.innerHTML = productArt(product, hex, { alt: `${product.name} in ${colorName}` });
  }
  $(".option-color", body).textContent = colorName;
  markActive(body.querySelectorAll(".swatch"), colorIndex);
  markActive(body.querySelectorAll(".size-btn"), product.sizes.indexOf(size));
  $(".qty-value", body).textContent = qty;
  $('[data-qty="-1"]', body).disabled = qty <= 1;
  $('[data-qty="1"]', body).disabled = qty >= MAX_QTY;
  $(".modal-add", body).textContent = `Add to cart · ${money.format(currentPrice(product) * qty)}`;
}

function openModal(product) {
  state.modal = {
    product,
    colorIndex: state.cardColors[product.id] ?? 0,
    size: defaultSize(product),
    qty: 1,
  };
  els.modalBody.innerHTML = modalHTML(product);
  els.modal.setAttribute("aria-labelledby", "modal-title");
  updateModal();
  els.modal.showModal();
  syncScrollLock();
}

// ---------- Cart ----------

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    // Drop anything that no longer matches the catalogue.
    return saved
      .filter((item) => {
        const product = item && findProduct(item.id);
        return product
          && product.colors.some(([name]) => name === item.color)
          && product.sizes.includes(item.size)
          && Number.isInteger(item.qty)
          && item.qty > 0;
      })
      .map((item) => ({
        key: cartKey(item.id, item.color, item.size),
        id: item.id,
        color: item.color,
        size: item.size,
        qty: Math.min(item.qty, MAX_QTY),
      }));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
  } catch {
    // Storage blocked or full: the cart still works for this visit.
  }
}

function commitCart() {
  saveCart();
  renderCart();
}

function addToCart(product, colorIndex, size, qty) {
  const color = product.colors[colorIndex][0];
  const key = cartKey(product.id, color, size);
  const existing = state.cart.find((item) => item.key === key);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, MAX_QTY);
  } else {
    state.cart.push({ key, id: product.id, color, size, qty });
  }
  commitCart();
  els.cartCount.classList.remove("bump");
  void els.cartCount.offsetWidth; // restart the animation
  els.cartCount.classList.add("bump");
  showToast(`Added ${product.name} (${color}, ${size}) to your cart`);
}

function quickAdd(product) {
  addToCart(product, state.cardColors[product.id] ?? 0, defaultSize(product), 1);
}

function updateCartItem(key, action) {
  const item = state.cart.find((entry) => entry.key === key);
  if (!item) return;
  if (action === "remove") {
    state.cart = state.cart.filter((entry) => entry !== item);
  } else {
    item.qty = clamp(item.qty + (action === "inc" ? 1 : -1), 1, MAX_QTY);
  }
  commitCart();

  // Re-rendering replaces the buttons, so put keyboard focus back where it was.
  const row = Array.from(els.cartItems.children).find((li) => li.dataset.key === key);
  const button = row && $(`[data-action="${action}"]`, row);
  (button && !button.disabled ? button : els.cartClose).focus();
}

function cartItemHTML(item) {
  const product = findProduct(item.id);
  const hex = product.colors.find(([name]) => name === item.color)[1];
  const price = currentPrice(product);
  return `
    <li class="cart-item" data-key="${escapeHTML(item.key)}">
      <div class="cart-thumb${photoClass(product)}">${productArt(product, hex)}</div>
      <div class="cart-info">
        <p class="cart-name">${escapeHTML(product.name)}</p>
        <p class="cart-meta">${escapeHTML(item.color)} · ${escapeHTML(item.size)} · ${money.format(price)}</p>
        <div class="qty qty-sm" role="group" aria-label="Quantity">
          <button type="button" data-action="dec" aria-label="Decrease quantity"${item.qty <= 1 ? " disabled" : ""}>&minus;</button>
          <span class="qty-value">${item.qty}</span>
          <button type="button" data-action="inc" aria-label="Increase quantity"${item.qty >= MAX_QTY ? " disabled" : ""}>+</button>
        </div>
      </div>
      <div class="cart-side">
        <strong class="cart-line-total">${money.format(price * item.qty)}</strong>
        <button class="link-btn" type="button" data-action="remove">Remove<span class="sr-only"> ${escapeHTML(product.name)}</span></button>
      </div>
    </li>`;
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + currentPrice(findProduct(item.id)) * item.qty, 0);

  els.cartCount.textContent = count;
  els.cartCount.hidden = count === 0;
  els.cartOpen.setAttribute("aria-label", `Open cart, ${count} ${count === 1 ? "item" : "items"}`);
  els.cartItems.innerHTML = state.cart.length
    ? state.cart.map(cartItemHTML).join("")
    : '<li class="cart-empty">Your cart is empty.</li>';
  els.subtotal.textContent = money.format(subtotal);
  els.checkout.disabled = count === 0;
}

// ---------- WhatsApp ordering ----------

function whatsappURL(text) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// lines: [{ product, color, size, qty }]
function orderMessage(lines) {
  let total = 0;
  const items = lines.map(({ product, color, size, qty }, index) => {
    const lineTotal = currentPrice(product) * qty;
    total += lineTotal;
    return [
      `${index + 1}. ${product.name}`,
      `   Colour: ${color} | Size: ${size} | Qty: ${qty}`,
      `   ${money.format(lineTotal)}`,
    ].join("\n");
  });
  return [
    `Hi ${STORE_NAME}! I'd like to place an order:`,
    "",
    items.join("\n\n"),
    "",
    `Total: ${money.format(total)}`,
    "",
    "Name:",
    "Phone:",
    "Delivery address:",
  ].join("\n");
}

function sendWhatsAppOrder(lines) {
  window.open(whatsappURL(orderMessage(lines)), "_blank", "noopener");
  showToast("Opening WhatsApp — just press send to place your order.");
}

function orderCart() {
  if (!state.cart.length) return;
  sendWhatsAppOrder(state.cart.map((item) => ({ ...item, product: findProduct(item.id) })));
}

// ---------- Drawer, scroll lock and toast ----------

let backdropTimer;

function isCartOpen() {
  return els.drawer.classList.contains("is-open");
}

function syncScrollLock() {
  document.body.classList.toggle("no-scroll", els.modal.open || isCartOpen());
}

function openCart() {
  clearTimeout(backdropTimer);
  els.backdrop.hidden = false;
  // Let the backdrop render once at opacity 0 so it fades in.
  requestAnimationFrame(() => els.backdrop.classList.add("is-open"));
  els.drawer.classList.add("is-open");
  els.drawer.setAttribute("aria-hidden", "false");
  els.cartOpen.setAttribute("aria-expanded", "true");
  syncScrollLock();
  els.cartClose.focus();
}

function closeCart() {
  if (!isCartOpen()) return;
  els.drawer.classList.remove("is-open");
  els.backdrop.classList.remove("is-open");
  els.drawer.setAttribute("aria-hidden", "true");
  els.cartOpen.setAttribute("aria-expanded", "false");
  syncScrollLock();
  backdropTimer = setTimeout(() => {
    els.backdrop.hidden = true;
  }, 300);
  els.cartOpen.focus();
}

let toastTimer;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2800);
}

// ---------- Events ----------

els.chips.forEach((chip) => {
  chip.addEventListener("click", () => setCategory(chip.dataset.category));
});

els.categoryLinks.forEach((link) => {
  link.addEventListener("click", () => setCategory(link.dataset.navCategory));
});

els.search.addEventListener("input", () => {
  state.query = els.search.value.trim();
  renderGrid();
});

els.sort.addEventListener("change", () => {
  state.sort = els.sort.value;
  renderGrid();
});

els.grid.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-color]");
  if (!target) return;
  const product = findProduct(target.closest(".card").dataset.id);
  if (target.dataset.color !== undefined) {
    setCardColor(product.id, Number(target.dataset.color));
  } else if (target.dataset.action === "open") {
    openModal(product);
  } else if (target.dataset.action === "quick-add") {
    quickAdd(product);
  }
});

els.modalBody.addEventListener("click", (event) => {
  const modal = state.modal;
  if (!modal) return;
  const swatch = event.target.closest("[data-color]");
  const sizeButton = event.target.closest("[data-size]");
  const qtyButton = event.target.closest("[data-qty]");

  if (swatch) {
    modal.colorIndex = Number(swatch.dataset.color);
    setCardColor(modal.product.id, modal.colorIndex);
  } else if (sizeButton) {
    modal.size = sizeButton.dataset.size;
  } else if (qtyButton) {
    modal.qty = clamp(modal.qty + Number(qtyButton.dataset.qty), 1, MAX_QTY);
  } else if (event.target.closest(".modal-add")) {
    addToCart(modal.product, modal.colorIndex, modal.size, modal.qty);
    els.modal.close();
    openCart();
    return;
  } else if (event.target.closest(".modal-whatsapp")) {
    const color = modal.product.colors[modal.colorIndex][0];
    sendWhatsAppOrder([{ product: modal.product, color, size: modal.size, qty: modal.qty }]);
    return;
  } else {
    return;
  }
  updateModal();
});

els.modalClose.addEventListener("click", () => els.modal.close());

// Backdrop clicks land on the <dialog> itself. Require the press to start there too,
// so dragging a text selection out of the modal doesn't close it.
let pressedOnBackdrop = false;
els.modal.addEventListener("pointerdown", (event) => {
  pressedOnBackdrop = event.target === els.modal;
});
els.modal.addEventListener("click", (event) => {
  if (pressedOnBackdrop && event.target === els.modal) els.modal.close();
});

// Escape closes the dialog natively; tidy up however it was closed.
els.modal.addEventListener("close", () => {
  state.modal = null;
  syncScrollLock();
});

els.cartOpen.addEventListener("click", openCart);
els.cartClose.addEventListener("click", closeCart);
els.backdrop.addEventListener("click", closeCart);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isCartOpen()) closeCart();
});

els.cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  updateCartItem(button.closest(".cart-item").dataset.key, button.dataset.action);
});

els.checkout.addEventListener("click", orderCart);

// ---------- Init ----------

els.cartOpen.setAttribute("aria-controls", "cart-drawer");
els.cartOpen.setAttribute("aria-expanded", "false");
document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
  link.href = whatsappURL(link.dataset.whatsappLink);
});
document.querySelectorAll("[data-whatsapp-icon]").forEach((slot) => {
  slot.outerHTML = WHATSAPP_ICON;
});
hideEmptyCategories();
renderHero();
renderGrid();
renderCart();
