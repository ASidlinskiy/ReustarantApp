import { menuArray } from "./data.js";

const menu = new Map(
  menuArray.map((item) => [item.id, { ...item, cents: Math.round(item.price * 100) }])
);
const cart = new Map();
const rows = new Map();
const addButtons = new Map();
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const formatMoney = (cents) => money.format(cents / 100);
const menuElement = document.querySelector(".menu");
const rowTemplate = document.querySelector("#cartRowTemplate");
const form = document.forms.namedItem("pickup-orders");
const fieldset = form.querySelector("fieldset");
const list = form.querySelector(".menu-item-form-cart");
const totalElement = form.querySelector(".menu-item-selected-order-total");
const emptyCart = document.querySelector("#empty-cart");
const receipt = document.querySelector("#receipt");
const status = document.querySelector("#submission-status");
const error = document.querySelector("#submission-error");
const customerName = form.elements.namedItem("customer-name");
const phone = form.elements.namedItem("phone");
const notes = form.elements.namedItem("notes");
let pending = false;
let attempt = null;

// Menu markup is rendered from data.js at build time. Attach behavior without layout shifts.
for (const button of menuElement.querySelectorAll("button[data-menu-id]")) {
  if (!menu.has(button.dataset.menuId)) throw new Error("Unknown menu item in the built page.");
  button.disabled = false;
  addButtons.set(button.dataset.menuId, button);
}
if (addButtons.size !== menu.size) throw new Error("The built menu is incomplete.");

function cartSnapshot() {
  return [...cart].map(([id, quantity]) => ({ ...menu.get(id), quantity }));
}
function subtotal(items = cartSnapshot()) {
  return items.reduce((sum, item) => sum + item.cents * item.quantity, 0);
}
function clearError() {
  error.hidden = true;
  error.textContent = "";
}
function showError(message) {
  status.textContent = "";
  error.textContent = message;
  error.hidden = false;
  error.focus();
}
function updateQuantity(id, next) {
  if (pending || !menu.has(id)) return;
  const item = menu.get(id);
  const quantity = Math.max(0, Math.min(99, next));
  const previousRow = rows.get(id);
  const hadFocus = previousRow?.contains(document.activeElement);
  clearError();
  receipt.hidden = true;
  if (quantity === 0) {
    cart.delete(id);
    previousRow?.remove();
    rows.delete(id);
    if (hadFocus) addButtons.get(id).focus();
  } else {
    cart.set(id, quantity);
    if (!previousRow) {
      const row = rowTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.menuId = id;
      row.querySelector(".cart-name").textContent = item.name;
      row
        .querySelector('[data-action="decrease"]')
        .setAttribute("aria-label", `Decrease ${item.name} quantity`);
      row
        .querySelector('[data-action="increase"]')
        .setAttribute("aria-label", `Increase ${item.name} quantity`);
      row
        .querySelector('[data-action="remove"]')
        .setAttribute("aria-label", `Remove ${item.name} from cart`);
      row.querySelector("output").setAttribute("aria-label", `${item.name} quantity`);
      rows.set(id, row);
      list.append(row);
    }
    const row = rows.get(id);
    row.querySelector("output").value = String(quantity);
    row.querySelector(".cart-price").textContent = formatMoney(item.cents * quantity);
    row.querySelector('[data-action="increase"]').disabled = quantity === 99;
  }
  const add = addButtons.get(id);
  add.disabled = quantity === 99;
  add.textContent = quantity ? `Add (${quantity})` : "Add";
  form.hidden = cart.size === 0;
  emptyCart.hidden = cart.size > 0;
  totalElement.textContent = `Estimated subtotal: ${formatMoney(subtotal())}`;
}
menuElement.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-menu-id]");
  if (button) updateQuantity(button.dataset.menuId, (cart.get(button.dataset.menuId) || 0) + 1);
});
list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest(".cart-row").dataset.menuId;
  const next =
    button.dataset.action === "remove"
      ? 0
      : cart.get(id) + (button.dataset.action === "increase" ? 1 : -1);
  updateQuantity(id, next);
});
function validate() {
  customerName.setCustomValidity(customerName.value.trim() ? "" : "Enter your name.");
  const value = phone.value.trim();
  const digits = value.replace(/\D/g, "");
  phone.setCustomValidity(
    /^[+()\d\s.-]+$/.test(value) && digits.length >= 7 && digits.length <= 15
      ? ""
      : "Enter a phone number with 7–15 digits."
  );
}
for (const input of [customerName, phone]) input.addEventListener("input", validate);
form.addEventListener("input", clearError);
function setPending(value) {
  pending = value;
  fieldset.disabled = value;
  form.setAttribute("aria-busy", String(value));
  for (const [id, button] of addButtons) button.disabled = value || cart.get(id) === 99;
}
function showReceipt(items, reference) {
  document.querySelector("#receipt-reference").textContent = `Request reference: ${reference}`;
  const lines = items.map((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.quantity} × ${item.name} — ${formatMoney(item.cents * item.quantity)}`;
    return li;
  });
  document.querySelector("#receipt-items").replaceChildren(...lines);
  document.querySelector("#receipt-total").textContent =
    `Estimated subtotal: ${formatMoney(subtotal(items))}`;
  cart.clear();
  rows.clear();
  list.replaceChildren();
  form.reset();
  for (const button of addButtons.values()) button.textContent = "Add";
  totalElement.textContent = "Estimated subtotal: $0.00";
  form.hidden = true;
  emptyCart.hidden = true;
  receipt.hidden = false;
  status.textContent = "";
  receipt.focus();
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pending) return;
  clearError();
  if (cart.size === 0) {
    showError("Add at least one item before sending an order request.");
    return;
  }
  validate();
  if (!form.checkValidity()) {
    error.textContent =
      "Please correct the highlighted pickup details before sending your request.";
    error.hidden = false;
    form.reportValidity();
    return;
  }
  if (!navigator.onLine) {
    showError(
      "You are offline. Reconnect to the internet, then send your request. Your cart and details have been kept."
    );
    return;
  }
  const items = cartSnapshot();
  const summary = items
    .map(
      (item) =>
        `${item.id}: ${item.quantity} × ${item.name} @ ${formatMoney(item.cents)} = ${formatMoney(item.cents * item.quantity)}`
    )
    .join("\n");
  const details = {
    "form-name": "pickup-orders",
    "customer-name": customerName.value.trim(),
    phone: phone.value.trim(),
    notes: notes.value.trim(),
    pickup: "ASAP",
    "order-summary": summary,
    "estimated-subtotal": (subtotal(items) / 100).toFixed(2),
    currency: "USD",
    "bot-field": form.elements.namedItem("bot-field").value,
  };
  // Reuse a reference only for an identical request after an uncertain failure.
  const fingerprint = JSON.stringify(details);
  if (attempt?.fingerprint !== fingerprint)
    attempt = { fingerprint, reference: crypto.randomUUID() };
  const reference = attempt.reference;
  details["request-reference"] = reference;
  for (const [key, value] of Object.entries(details)) form.elements.namedItem(key).value = value;
  setPending(true);
  status.textContent = "Sending your order request…";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(details).toString(),
      signal: controller.signal,
    });
    if (!response.ok) {
      const failure = new Error("Submission was not acknowledged.");
      failure.status = response.status;
      throw failure;
    }
    showReceipt(items, reference);
    attempt = null;
  } catch (failure) {
    const reason =
      failure.name === "AbortError"
        ? "The request timed out."
        : failure.status === 429
          ? "The order service is busy. Wait a moment before retrying."
          : failure.status >= 500
            ? "The order service is temporarily unavailable."
            : failure.status
              ? "The order service could not process this request. Check your details and try again."
              : "The connection was interrupted. Check your internet connection.";
    showError(
      `${reason} We could not confirm receipt of request ${reference}. Your cart and details are still here. You can retry; staff should treat matching references as the same request.`
    );
  } finally {
    clearTimeout(timeout);
    setPending(false);
  }
});
document.querySelector("#start-again").addEventListener("click", () => {
  receipt.hidden = true;
  emptyCart.hidden = false;
  attempt = null;
  addButtons.values().next().value.focus();
});

// Keep native validation messages, but also show a persistent form-level explanation.
form.noValidate = true;
