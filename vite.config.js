import { defineConfig } from "vite";
import { menuArray } from "./data.js";

const escapeHTML = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export default defineConfig({
  plugins: [
    {
      name: "static-menu",
      transformIndexHtml(html) {
        const items = menuArray
          .map(
            (item) => `<article class="menu-item">
        <p class="menu-item-emoji" aria-hidden="true">${escapeHTML(item.emoji)}</p>
        <div class="menu-item-description">
          <h3 class="menu-item-description-heading">${escapeHTML(item.name)}</h3>
          <p class="menu-item-description-ingredients">${escapeHTML(item.ingredients.join(", "))}</p>
          <p class="menu-item-description-price">${money.format(item.price)}</p>
        </div>
        <button class="menu-item-button-add" type="button" data-menu-id="${escapeHTML(item.id)}" aria-label="Add ${escapeHTML(item.name)} to cart" disabled>Add</button>
      </article>`
          )
          .join("\n");
        return html.replace("<!--menu-items-->", items);
      },
    },
  ],
});
