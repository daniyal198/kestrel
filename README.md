# Fakhir Outwears

A static storefront for bomber jackets. Customers browse, pick a size and quantity, and send their order to the store on WhatsApp. Plain HTML, CSS and JavaScript — no framework, no build step, no dependencies.

## Run it

Open `index.html` in a browser. That's it.

If you'd rather serve it (some browsers restrict `localStorage` on `file://` pages), any static server works:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

| File               | What it does                                                                     |
| ------------------ | -------------------------------------------------------------------------------- |
| `index.html`       | Page layout: header, hero, perks, shop, WhatsApp band, footer, modal, cart drawer |
| `products.js`      | The `PRODUCTS` catalogue — edit this to add or change products                   |
| `reviews.js`       | Customer reviews shown on the home page and every product page (build-time only) |
| `images/products/` | Product photos (900×1200, 3:4): `.webp` for the site, `.jpg` twins for link previews |
| `products/<id>/`   | One page per product, **generated** by `scripts/build-pages.mjs` — don't edit by hand |
| `scripts/build-pages.mjs` | Builds the product pages, `sitemap.xml`, `robots.txt`, and the structured data and reviews section in `index.html` |
| `vercel.json`      | Trailing-slash redirects and image caching                                       |
| `favicon.svg`      | The "F" monogram, used as the browser-tab icon (the same mark is inline in the header and footer) |
| `styles.css`       | Light-theme styles, responsive down to 360px                                     |
| `app.js`           | Rendering, filters, product modal, cart, WhatsApp ordering and toasts            |

## How ordering works

- **Order on WhatsApp** in the cart opens a WhatsApp chat with the store, pre-filled with every item's name, colour, size, quantity and price, the total, and blanks for the customer's name, phone and address. The customer just presses send.
- **Order now on WhatsApp** in a product's window does the same for that one product.
- The floating green button, hero button and "Chat with us" band open a plain chat for questions.
- The number lives in `WHATSAPP_NUMBER` at the top of `app.js` (country code + number, digits only, e.g. `923234123244`).

Prices are in PKR.

## Adding a product

1. Put a 3:4 photo in `images/products/` (900×1200 is ideal) as both JPEG and WebP. On a Mac:
   ```sh
   sips -s format jpeg -s formatOptions 80 -z 1200 900 photo.jpg --out images/products/my-jacket.jpg
   cwebp -q 80 -m 6 images/products/my-jacket.jpg -o images/products/my-jacket.webp   # brew install webp
   ```
2. Add an object to `PRODUCTS` in `products.js`:

```js
{
  id: "unique-id",
  name: "Product Name",
  category: "jackets",        // or "tracksuits"
  type: "jacket",             // or "tracksuit"; used for the drawing when there's no photo
  image: "images/products/my-jacket.webp",
  price: 6500,                // PKR
  salePrice: 5500,            // optional; puts it in the Sale filter
  tag: "New",                 // optional badge: "New", "Sale" or "Bestseller"
  colors: [["Black", "#1d1f23"]],
  sizes: ["M", "L"],
  description: "One or two sentences.",
},
```

3. Rebuild the SEO pages: `node scripts/build-pages.mjs` (Node 18+, no install needed). Do this after **any** change to `products.js`, then commit the generated files.

Category chips and nav links with no products (e.g. Tracksuits, or Sale when nothing is discounted) hide themselves. `rating` and `reviews` are optional and only shown when set; set them only from real customer reviews, because they also go into Google's structured data.

## Adding a review

Add an entry to `REVIEWS` in `reviews.js` (`name`, `rating` out of 5, and the customer's words exactly as sent), then run `node scripts/build-pages.mjs`. Only add real reviews you have permission to show. They're marked up as reviews of the store; Google doesn't show stars in search for reviews a business publishes about itself, but they still help shoppers on the page.

## Analytics and SEO

- **Vercel Web Analytics** loads from `/_vercel/insights/script.js` (snippet in the `<head>` of every page). Turn it on in the Vercel dashboard under the project's **Analytics** tab; until then that script 404s, which is harmless. Each WhatsApp order (cart or product page) also sends a `WhatsApp order` custom event (custom events need a Vercel Pro plan to show up).
- **Keyword mapping.** The home page targets "bomber jackets in Lahore" (title, hero, the "Bomber jackets in Lahore" section, `ClothingStore` structured data). Each product page at `/products/<id>/` targets "buy <product> in Lahore", with `Product` and `BreadcrumbList` structured data.
- **Architecture.** Every product page is one click from the home page: product cards are real links (a plain click still opens the quick view; ctrl/cmd-click opens the page). Shop filters, search and sort only change what's shown and never create new URLs, so there are no duplicate filter pages to crawl.
- **Speed.** Photos are WebP (about 73% smaller than the JPEGs), the first hero photo is preloaded, grid images load lazily and images are cached for a week.
- **Domain.** The live domain `https://fakhir-store.vercel.app` is written in `index.html` (canonical, Open Graph, structured data). The build script reads it from the canonical link for everything it generates. If you move to a custom domain, replace it in `index.html` and rerun the build.
