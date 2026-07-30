import { menuArray } from "./data";

const menuItemElement = document.querySelector(".wrapper .menu");
const menuSelectedElement = document.querySelector(".menu-item-selected");
const menuTemplate = document.getElementById("menuItemTemplate");

// Single source of truth for what's in the cart: the menu items themselves.
const cart = [];

let cartForm = null;

function displayMenuHTML() {
  menuArray.forEach((menu) => {
    const { emoji, name, ingredients, price, id } = menu;
    const menuItem = menuTemplate.content.cloneNode(true).children[0];
    const emojiElement = menuItem.querySelector(".menu-item-emoji");
    const addButton = menuItem.querySelector(".menu-item-button-add");
    const nameElement = menuItem.querySelector(".menu-item-description-heading");
    const ingredientsElement = menuItem.querySelector(".menu-item-description-ingredients");
    const priceElement = menuItem.querySelector(".menu-item-description-price");

    if (emojiElement) emojiElement.textContent = emoji;
    if (nameElement) nameElement.textContent = name;
    if (ingredientsElement) ingredientsElement.textContent = ingredients.join(", ");
    if (priceElement) priceElement.textContent = `$${price}`;
    if (addButton) {
      addButton.dataset.menuId = id;
      addButton.setAttribute("aria-label", `Add ${name} to cart`);
      addButton.setAttribute("aria-pressed", "false");
    }

    if (menuItemElement && menuItem) {
      menuItemElement.append(menuItem);
    } else {
      console.error("menuItemElement or menuItem is null");
    }
  });
}

function ensureCartForm() {
  if (cartForm) return cartForm;

  cartForm = menuTemplate.content.cloneNode(true).children[1];
  menuSelectedElement.append(cartForm);

  cartForm.addEventListener("submit", (e) => {
    e.preventDefault(); // never reload the page / wipe the cart on submit
    cartForm.querySelector("h2").textContent = "Thanks! Your order is in. 🎉";

    cart.length = 0;
    document.querySelectorAll(".menu-item-button-add.active").forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
      button.textContent = "add";
    });
    renderCart();
  });

  cartForm.addEventListener("click", (e) => {
    if (!e.target.classList.contains("menu-item-form-cart-btn")) return;
    removeFromCart(e.target.dataset.menuId);
  });

  return cartForm;
}

function renderCart() {
  const form = ensureCartForm();
  const list = form.querySelector(".menu-item-form-cart");
  list.innerHTML = "";

  cart.forEach((item) => {
    const row = menuTemplate.content.querySelector(".row").cloneNode(true);
    row.querySelector(".menu-item-form-cart-emoji").textContent = item.emoji;
    row.querySelector(".menu-item-form-cart-name").textContent = item.name;
    row.querySelector(".menu-item-form-cart-price").textContent = `$${item.price}`;
    const removeButton = row.querySelector(".menu-item-form-cart-btn");
    removeButton.dataset.menuId = item.id;
    removeButton.setAttribute("aria-label", `Remove ${item.name} from cart`);
    list.append(row);
  });

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const totalElement = form.querySelector(".menu-item-selected-order-total");
  if (totalElement) totalElement.textContent = `Total: $${total}`;

  const isVisible = cart.length > 0;
  menuSelectedElement.style.display = isVisible ? "flex" : "none";

  const lastMenuItem = document.querySelector(".menu-item:last-child");
  if (lastMenuItem) {
    lastMenuItem.style.marginBottom = isVisible ? `${menuSelectedElement.clientHeight}px` : "0";
  }
}

function addToCart(menuId) {
  const item = menuArray.find((menu) => menu.id === menuId);
  if (!item) return;
  cart.push(item);
  renderCart();
}

function removeFromCart(menuId) {
  const index = cart.findIndex((item) => item.id === menuId);
  if (index > -1) cart.splice(index, 1);

  const addButton = document.querySelector(`.menu-item-button-add[data-menu-id="${menuId}"]`);
  if (addButton) {
    addButton.classList.remove("active");
    addButton.setAttribute("aria-pressed", "false");
    addButton.textContent = "add";
  }

  renderCart();
}

displayMenuHTML();

menuItemElement.addEventListener("click", (e) => {
  if (!e.target.classList.contains("menu-item-button-add")) return;

  const button = e.target;
  const menuId = button.dataset.menuId;

  if (!button.classList.contains("active")) {
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    button.textContent = "✓ added";
    addToCart(menuId);
  } else {
    removeFromCart(menuId);
  }
});
