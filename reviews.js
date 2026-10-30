// Customer reviews, shown on the home page and every product page.
// Only real reviews, word for word. After editing, run: node scripts/build-pages.mjs
// These are reviews of the store (they don't name a jacket), so they're marked up for Google
// on the store, not on individual products. To review a specific jacket, use `rating` and
// `reviews` on that product in products.js instead.
const REVIEWS = [
  {
    name: "Ashar",
    rating: 5,
    text: "Honestly the best jackets I've ever owned. The quality is amazing, the zippers are heavy-duty, and it actually keeps you warm. Worth every penny.",
  },
  {
    name: "Faiq",
    rating: 5,
    text: "Always get compliments whenever I wear my jacket from here. It feels premium, fits perfectly, and doesn't feel bulky at all. 10/10.",
  },
  {
    name: "Daniyal",
    rating: 5,
    text: "Super impressed with the quality here. Picked up a jacket last month and I've been wearing it non-stop. True to size and really comfortable.",
  },
  {
    name: "Abubakar",
    rating: 5,
    text: "If you want a jacket that actually holds up in bad weather, buy it here. Great materials, smart pocket layouts, and looks great too.",
  },
  {
    name: "Haider",
    rating: 5,
    text: "Great selection and even better quality. The staff was super helpful in helping me find the right size. Will definitely be buying from here again.",
  },
];
