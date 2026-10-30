// Builds the SEO pages from the catalogue, so each product has a real, crawlable URL:
//   products/<id>/index.html   one page per product, with Product + Breadcrumb structured data
//   sitemap.xml                home + every product page, with images
//   index.html                 structured data and the reviews section, between "generated:" markers
//
// Run after editing products.js:  node scripts/build-pages.mjs
// No dependencies. The live domain is read from the canonical link in index.html.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const write = (file, content) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), content);
};

// ---------- Inputs (single sources of truth) ----------

const PRODUCTS = vm.runInNewContext(`${read("products.js")}; PRODUCTS`);
const missingPhoto = PRODUCTS.find((product) => !product.image);
if (missingPhoto) throw new Error(`"${missingPhoto.id}" needs an image: every product page shows its photo`);
const REVIEWS = vm.runInNewContext(`${read("reviews.js")}; REVIEWS`);
const appJS = read("app.js");
let indexHTML = read("index.html");

const match = (source, pattern, label) => {
  const found = source.match(pattern);
  if (!found) throw new Error(`Could not find ${label}`);
  return found[1];
};
const STORE_NAME = match(appJS, /const STORE_NAME = "([^"]+)"/, "STORE_NAME in app.js");
const WHATSAPP_NUMBER = match(appJS, /const WHATSAPP_NUMBER = "(\d+)"/, "WHATSAPP_NUMBER in app.js");
const WHATSAPP_ICON = match(appJS, /const WHATSAPP_ICON = `([\s\S]*?)`;/, "WHATSAPP_ICON in app.js");
const SITE = match(indexHTML, /<link rel="canonical" href="([^"]+)">/, "canonical link in index.html");
const LOGO_MARK = match(indexHTML, /(<svg class="logo-mark"[\s\S]*?<\/svg>)/, "logo mark in index.html");

const money = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
const currentPrice = (product) => product.salePrice ?? product.price;
const productPath = (product) => `/products/${product.id}/`;
const absolute = (url) => new URL(url, SITE).href;
// JPEG twin of a product photo, used for link previews (WhatsApp and Facebook handle JPEG most reliably).
const shareImage = (product) => {
  const jpg = product.image.replace(/\.webp$/, ".jpg");
  return fs.existsSync(path.join(ROOT, jpg)) ? jpg : product.image;
};

const escapeHTML = (value) => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jsonLD = (data) => `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n  </script>`;

// ---------- Shared markup ----------

const analyticsHead = `<!-- Vercel Web Analytics -->
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>`;

const logo = (extraClass = "") => `<a class="logo${extraClass}" href="/" aria-label="${STORE_NAME} home">
        ${LOGO_MARK}
        <span class="logo-text"><span class="logo-name">Fakhir</span><span class="logo-tag">Outwears</span></span>
      </a>`;

const whatsappURL = (text) => `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const QUESTION = `Hi ${STORE_NAME}! I have a question about your jackets.`;

// Same layout as orderMessage() in app.js, for one item.
function orderMessage(product, size) {
  const color = product.colors.length === 1
    ? product.colors[0][0]
    : `${product.colors.map(([name]) => name).join(" / ")} (please choose)`;
  const price = money.format(currentPrice(product));
  return [
    `Hi ${STORE_NAME}! I'd like to place an order:`,
    "",
    `1. ${product.name}`,
    `   Colour: ${color} | Size: ${size} | Qty: 1`,
    `   ${price}`,
    "",
    `Total: ${price}`,
    "",
    "Name:",
    "Phone:",
    "Delivery address:",
  ].join("\n");
}

function priceHTML(product) {
  if (product.salePrice == null) {
    return `<p class="price"><span class="price-now">${money.format(product.price)}</span></p>`;
  }
  return `<p class="price is-sale">
          <span class="price-now">${money.format(product.salePrice)}</span>
          <s class="price-was"><span class="sr-only">Was </span>${money.format(product.price)}</s>
        </p>`;
}

function ratingHTML(product) {
  if (product.rating == null) return "";
  return `<div class="rating" role="img" aria-label="Rated ${product.rating} out of 5 from ${product.reviews} reviews">
          <span class="stars" style="--rating: ${product.rating}"></span>
          <span class="rating-value">${product.rating.toFixed(1)}</span>
          <span class="rating-count">(${product.reviews})</span>
        </div>`;
}

function badgeHTML(product) {
  if (!product.tag) return "";
  return `<span class="badge badge-${product.tag.toLowerCase()}">${escapeHTML(product.tag)}</span>`;
}

function relatedCardHTML(product) {
  const name = escapeHTML(product.name);
  return `
        <article class="card">
          <a class="card-media has-photo" href="${productPath(product)}">
            ${badgeHTML(product)}
            <span class="card-art"><img class="product-photo" src="/${product.image}" alt="${name}" width="900" height="1200" loading="lazy"></span>
          </a>
          <div class="card-body">
            <h3 class="card-title"><a class="card-link" href="${productPath(product)}">${name}</a></h3>
            ${priceHTML(product)}
            <p class="card-sizes">Sizes: ${product.sizes.map(escapeHTML).join(" · ")}</p>
          </div>
        </article>`;
}

const averageRating = REVIEWS.length
  ? Math.round((REVIEWS.reduce((sum, review) => sum + review.rating, 0) / REVIEWS.length) * 10) / 10
  : 0;

function reviewsHTML() {
  if (!REVIEWS.length) return "";
  const count = `${REVIEWS.length} ${REVIEWS.length === 1 ? "review" : "reviews"}`;
  const cards = REVIEWS.map((review) => `
        <figure class="review">
          <span class="stars" role="img" aria-label="${review.rating} out of 5 stars" style="--rating: ${review.rating}"></span>
          <blockquote><p>${escapeHTML(review.text)}</p></blockquote>
          <figcaption>${escapeHTML(review.name)}<span> · via WhatsApp</span></figcaption>
        </figure>`).join("");
  return `<section class="reviews container" aria-labelledby="reviews-title">
      <div class="reviews-head">
        <h2 id="reviews-title">What our customers say</h2>
        <div class="rating" role="img" aria-label="Rated ${averageRating.toFixed(1)} out of 5 from ${count}">
          <span class="stars" style="--rating: ${averageRating}"></span>
          <span class="rating-value">${averageRating.toFixed(1)}</span>
          <span class="rating-count">from ${count}</span>
        </div>
      </div>
      <!-- One scrolling row. The second copy makes the loop seamless and is hidden from screen readers. -->
      <div class="reviews-marquee" style="--review-count: ${REVIEWS.length}">
        <div class="reviews-track">
          <div class="reviews-group">${cards}
          </div>
          <div class="reviews-group" aria-hidden="true">${cards}
          </div>
        </div>
      </div>
    </section>`;
}

// ---------- Structured data ----------

const STORE_ID = `${SITE}#store`;

// Merges into the ClothingStore block in index.html through the shared @id.
function storeReviewsSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    "@id": STORE_ID,
    name: STORE_NAME,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: averageRating,
      bestRating: 5,
      reviewCount: REVIEWS.length,
    },
    review: REVIEWS.map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.name },
      reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
      reviewBody: review.text,
    })),
  };
}

function productSchema(product) {
  const data = {
    "@type": "Product",
    "@id": `${absolute(productPath(product))}#product`,
    name: product.name,
    description: product.description,
    image: [absolute(product.image), absolute(shareImage(product))].filter((url, i, all) => all.indexOf(url) === i),
    sku: product.id,
    brand: { "@type": "Brand", name: STORE_NAME },
    category: "Apparel & Accessories > Clothing > Outerwear > Coats & Jackets",
    color: product.colors.map(([name]) => name).join(" / "),
    size: product.sizes,
    offers: {
      "@type": "Offer",
      url: absolute(productPath(product)),
      price: currentPrice(product),
      priceCurrency: "PKR",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      areaServed: { "@type": "City", name: "Lahore" },
      seller: { "@type": "ClothingStore", "@id": STORE_ID, name: STORE_NAME },
    },
  };
  // Only real, on-page reviews: set rating and reviews in products.js once you have them.
  if (product.rating != null && product.reviews) {
    data.aggregateRating = { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviews };
  }
  return data;
}

function breadcrumbSchema(product) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Bomber jackets", item: `${SITE}#shop` },
      { "@type": "ListItem", position: 3, name: product.name, item: absolute(productPath(product)) },
    ],
  };
}

// ---------- Product page ----------

function productPage(product) {
  const name = escapeHTML(product.name);
  const price = money.format(currentPrice(product));
  const url = absolute(productPath(product));
  const firstSentence = product.description.match(/^[^.]+\./)?.[0] ?? product.description;
  const title = `Buy ${product.name} in Lahore | ${STORE_NAME}`;
  const description = `${product.name} for ${price}, sizes ${product.sizes.join(" and ")}. ${firstSentence} Delivered across Lahore. Order on WhatsApp.`;
  const colors = product.colors.map(([colorName]) => colorName).join(", ");
  const related = PRODUCTS.filter((other) => other.id !== product.id && other.image);

  const sizeButtons = product.sizes.map((size) => `
            <a class="btn btn-whatsapp" href="${escapeHTML(whatsappURL(orderMessage(product, size)))}" target="_blank" rel="noopener" data-order>${WHATSAPP_ICON}Order size ${escapeHTML(size)}</a>`).join("");

  return `<!doctype html>
<html lang="en-PK">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Generated by scripts/build-pages.mjs from products.js. Edit those, not this file. -->
  <title>${escapeHTML(title)}</title>
  <meta name="description" content="${escapeHTML(description)}">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&text=FAKHIRfakhir&display=swap">
  <link rel="stylesheet" href="/styles.css">

  <meta property="og:type" content="product">
  <meta property="og:site_name" content="${STORE_NAME}">
  <meta property="og:locale" content="en_PK">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHTML(`${product.name} | ${STORE_NAME}`)}">
  <meta property="og:description" content="${escapeHTML(`${price} · Sizes ${product.sizes.join(", ")} · Delivered across Lahore. Order on WhatsApp.`)}">
  <meta property="og:image" content="${absolute(shareImage(product))}">
  <meta property="og:image:width" content="900">
  <meta property="og:image:height" content="1200">
  <meta property="og:image:alt" content="${name}">
  <meta property="product:price:amount" content="${currentPrice(product)}">
  <meta property="product:price:currency" content="PKR">
  <meta name="twitter:card" content="summary_large_image">

  ${jsonLD({ "@context": "https://schema.org", "@graph": [productSchema(product), breadcrumbSchema(product)] })}

  ${analyticsHead}
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      ${logo()}
      <nav class="main-nav" aria-label="Primary">
        <a href="/#shop">All jackets</a>
      </nav>
    </div>
  </header>

  <main>
    <nav class="breadcrumbs container" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href="/#shop">Bomber jackets</a></li>
        <li aria-current="page">${name}</li>
      </ol>
    </nav>

    <section class="pdp container">
      <div class="pdp-media">
        <img class="product-photo" src="/${product.image}" alt="${name} in ${escapeHTML(colors)}" width="900" height="1200" fetchpriority="high">
      </div>
      <div class="pdp-info">
        ${badgeHTML(product)}
        <h1>${name}</h1>
        ${ratingHTML(product)}
        ${priceHTML(product)}
        <p class="pdp-desc">${escapeHTML(product.description)}</p>
        <dl class="pdp-facts">
          <div><dt>Colour</dt><dd>${escapeHTML(colors)}</dd></div>
          <div><dt>Sizes</dt><dd>${product.sizes.map(escapeHTML).join(", ")}</dd></div>
          <div><dt>Delivery</dt><dd>Across Lahore</dd></div>
        </dl>
        <div class="pdp-order">
          <p class="option-label">Order on WhatsApp</p>
          <div class="pdp-sizes">${sizeButtons}
          </div>
          <a class="btn btn-outline btn-block" href="/#product-${product.id}">Add to cart and keep shopping</a>
          <p class="pdp-note">WhatsApp opens with your order filled in. Just press send, and we'll confirm your size, address and delivery with you.</p>
        </div>
      </div>
    </section>

    ${reviewsHTML()}

    <section class="related container" aria-labelledby="related-title">
      <h2 id="related-title">More bomber jackets in Lahore</h2>
      <div class="grid">${related.map(relatedCardHTML).join("")}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        ${logo(" logo-sm")}
        <p>&copy; 2026 ${STORE_NAME} · Lahore, Pakistan</p>
      </div>
      <nav aria-label="Footer">
        <a href="/#shop">Shop</a>
        <a href="${whatsappURL("")}" target="_blank" rel="noopener">WhatsApp: +92 323 4123244</a>
      </nav>
    </div>
  </footer>

  <a class="wa-float" href="${escapeHTML(whatsappURL(QUESTION))}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">${WHATSAPP_ICON}</a>

  <script>
    // Vercel Analytics custom event, matching the one app.js sends for cart orders.
    document.querySelectorAll("[data-order]").forEach((link) => {
      link.addEventListener("click", () => {
        window.va?.("event", { name: "WhatsApp order", data: { items: 1, total: ${currentPrice(product)} } });
      });
    });
  </script>
</body>
</html>
`;
}

// ---------- Write everything ----------

// Remove pages for products that no longer exist.
const productsDir = path.join(ROOT, "products");
if (fs.existsSync(productsDir)) {
  const ids = new Set(PRODUCTS.map((product) => product.id));
  for (const entry of fs.readdirSync(productsDir)) {
    if (!ids.has(entry)) fs.rmSync(path.join(productsDir, entry), { recursive: true });
  }
}
for (const product of PRODUCTS) {
  write(`products/${product.id}/index.html`, productPage(product));
}

const itemList = jsonLD({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: `${STORE_NAME} bomber jackets in Lahore`,
  itemListElement: PRODUCTS.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: absolute(productPath(product)),
    name: product.name,
  })),
});
function fillMarkers(name, content) {
  const markers = new RegExp(`(<!-- generated:${name} -->)[\\s\\S]*?(<!-- /generated:${name} -->)`);
  if (!markers.test(indexHTML)) throw new Error(`index.html is missing the generated:${name} markers`);
  indexHTML = indexHTML.replace(markers, (_, open, close) => `${open}\n  ${content}\n  ${close}`);
}
fillMarkers("structured-data", REVIEWS.length ? `${itemList}\n  ${jsonLD(storeReviewsSchema())}` : itemList);
fillMarkers("reviews", reviewsHTML());
write("index.html", indexHTML);

const today = new Date().toISOString().slice(0, 10);
const sitemapEntry = (loc, images) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
${images.map((image) => `    <image:image><image:loc>${absolute(image)}</image:loc></image:image>`).join("\n")}
  </url>`;
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[
  sitemapEntry(SITE, PRODUCTS.filter((product) => product.image).map((product) => product.image)),
  ...PRODUCTS.map((product) => sitemapEntry(absolute(productPath(product)), product.image ? [product.image] : [])),
].join("\n")}
</urlset>
`);

write("robots.txt", `User-agent: *
Allow: /

Sitemap: ${absolute("/sitemap.xml")}
`);

console.log(`Built ${PRODUCTS.length} product pages, sitemap.xml, robots.txt, and index.html's structured data and ${REVIEWS.length} reviews.`);
