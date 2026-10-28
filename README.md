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
| `images/products/` | Product photos (900×1200 JPEG, 3:4)                                              |
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

1. Put a 3:4 photo in `images/products/` (900×1200 is ideal). On a Mac you can resize with
   `sips -s format jpeg -s formatOptions 80 -z 1200 900 photo.jpg --out images/products/my-jacket.jpg`.
2. Add an object to `PRODUCTS` in `products.js`:

```js
{
  id: "unique-id",
  name: "Product Name",
  category: "jackets",        // or "tracksuits"
  type: "jacket",             // or "tracksuit"; used for the drawing when there's no photo
  image: "images/products/my-jacket.jpg",
  price: 6500,                // PKR
  salePrice: 5500,            // optional; puts it in the Sale filter
  tag: "New",                 // optional badge: "New", "Sale" or "Bestseller"
  colors: [["Black", "#1d1f23"]],
  sizes: ["M", "L"],
  description: "One or two sentences.",
},
```

Category chips and nav links with no products (e.g. Tracksuits, or Sale when nothing is discounted) hide themselves. `rating` and `reviews` are optional and only shown when set.
