import { test, expect } from "@playwright/test";

const add = (page, name = "Pizza") =>
  page.getByRole("button", { name: `Add ${name} to cart`, exact: true });
const fill = async (page) => {
  await page.getByLabel("Name", { exact: true }).fill("Preview Test Customer");
  await page.getByLabel("Phone number", { exact: true }).fill("+1 (202) 555-0100");
};
const send = (page) => page.getByRole("button", { name: "Send order request", exact: true });
const total = (page) => page.locator(".menu-item-selected-order-total");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the menu once, with a title and description", async ({ page }) => {
  await expect(page.locator(".menu .menu-item")).toHaveCount(12);
  await expect(page).toHaveTitle(/Al's Diner/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Order/);
  await expect(page.locator("#empty-cart")).toBeVisible();
  await expect(page.locator("form")).toBeHidden();
});

test("quantities, line totals, and subtotal stay synchronized", async ({ page }) => {
  await add(page).click();
  await add(page).click();
  await add(page, "Cheeseburger").click();
  await expect(page.locator(".cart-row")).toHaveCount(2);
  await expect(page.getByLabel("Pizza quantity", { exact: true })).toHaveText("2");
  await expect(total(page)).toHaveText("Estimated subtotal: $40.00");
  await expect(page.locator('[data-menu-id="pizza"] .cart-price')).toHaveText("$28.00");
  await page.getByRole("button", { name: "Decrease Pizza quantity", exact: true }).click();
  await expect(total(page)).toHaveText("Estimated subtotal: $26.00");
  await page.getByRole("button", { name: "Remove Pizza from cart", exact: true }).click();
  await expect(total(page)).toHaveText("Estimated subtotal: $12.00");
});

test("decreasing to zero removes the row and restores focus", async ({ page }) => {
  await add(page).click();
  await page.getByRole("button", { name: "Decrease Pizza quantity", exact: true }).click();
  await expect(page.locator(".cart-row")).toHaveCount(0);
  await expect(page.locator("#empty-cart")).toBeVisible();
  await expect(add(page)).toBeFocused();
});

test("enforces the quantity limit and can decrease again", async ({ page }) => {
  await add(page).evaluate((button) => {
    for (let i = 0; i < 110; i++) button.click();
  });
  await expect(page.getByLabel("Pizza quantity", { exact: true })).toHaveText("99");
  await expect(add(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Increase Pizza quantity", exact: true })
  ).toBeDisabled();
  await expect(total(page)).toHaveText("Estimated subtotal: $1,386.00");
  await page.getByRole("button", { name: "Decrease Pizza quantity", exact: true }).click();
  await expect(add(page)).toBeEnabled();
});

test("cart updates preserve the input node, customer details, and keyboard focus", async ({
  page,
}) => {
  await add(page).click();
  await fill(page);
  await page.getByLabel("Order notes", { exact: false }).fill("Test note");
  await page.getByLabel("Name", { exact: true }).focus();
  await page.evaluate(() => {
    window.originalInput = document.querySelector("#customer-name");
  });
  await add(page, "Fries").evaluate((button) => button.click());
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  expect(
    await page.evaluate(() => window.originalInput === document.querySelector("#customer-name"))
  ).toBe(true);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Preview Test Customer");
  await expect(page.getByLabel("Order notes", { exact: false })).toHaveValue("Test note");
});

test("rejects an empty cart even for a synthetic submit", async ({ page }) => {
  let posts = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.abort();
    } else await route.continue();
  });
  await page.locator("form").dispatchEvent("submit");
  await expect(page.getByRole("alert")).toHaveText(/Add at least one item/);
  expect(posts).toBe(0);
});

test("requires a nonblank name and valid phone, and limits notes", async ({ page }) => {
  let posts = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.abort();
    } else await route.continue();
  });
  await add(page).click();
  await send(page).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("   ");
  await page.getByLabel("Phone number", { exact: true }).fill("123");
  await send(page).click();
  expect(
    await page.getByLabel("Name", { exact: true }).evaluate((input) => input.checkValidity())
  ).toBe(false);
  await page.getByLabel("Name", { exact: true }).fill("Test");
  for (const phone of ["123", "1234567890123456", "call me 2025550100"]) {
    await page.getByLabel("Phone number", { exact: true }).fill(phone);
    expect(
      await page
        .getByLabel("Phone number", { exact: true })
        .evaluate((input) => input.checkValidity())
    ).toBe(false);
  }
  await page.getByLabel("Phone number", { exact: true }).fill("+44 20 7946 0958");
  expect(
    await page
      .getByLabel("Phone number", { exact: true })
      .evaluate((input) => input.checkValidity())
  ).toBe(true);
  await expect(page.getByLabel("Order notes", { exact: false })).toHaveAttribute(
    "maxlength",
    "500"
  );
  expect(posts).toBe(0);
});

test("sends registered fields and shows a visible, persistent receipt without navigating", async ({
  page,
}) => {
  let submitted;
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submitted = Object.fromEntries(new URLSearchParams(route.request().postData()));
    await route.fulfill({ status: 200, body: "OK" });
  });
  await add(page).click();
  await add(page).click();
  await fill(page);
  await page.getByLabel("Order notes", { exact: false }).fill("No onions & extra cheese");
  await send(page).click();
  await expect(page.locator("#receipt")).toBeVisible();
  await expect(page.locator("#receipt")).toBeFocused();
  await expect(page.locator("#receipt-title")).toHaveText(/awaiting restaurant confirmation/);
  await expect(page.locator("#receipt-items")).toContainText("2 × Pizza");
  await expect(page.locator("#receipt-total")).toHaveText("Estimated subtotal: $28.00");
  await expect(page).toHaveURL(/\/$/);
  expect(submitted).toMatchObject({
    "form-name": "pickup-orders",
    "customer-name": "Preview Test Customer",
    phone: "+1 (202) 555-0100",
    notes: "No onions & extra cheese",
    pickup: "ASAP",
    currency: "USD",
    "estimated-subtotal": "28.00",
    "bot-field": "",
  });
  expect(submitted["order-summary"]).toContain("pizza: 2 × Pizza @ $14.00 = $28.00");
  expect(submitted["request-reference"]).toMatch(/^[a-f0-9-]{36}$/);
  await expect(page.locator("#receipt-reference")).toContainText(submitted["request-reference"]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.getByRole("button", { name: "Start another order" }).click();
  await expect(add(page)).toBeFocused();
  await add(page).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(page.locator("#receipt")).toBeHidden();
});

test("blocks duplicate submissions and freezes the cart while sending", async ({ page }) => {
  let posts = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    await gate;
    await route.fulfill({ status: 200, body: "OK" });
  });
  await add(page).click();
  await fill(page);
  await send(page).click();
  await expect(send(page)).toBeDisabled();
  await expect(add(page)).toBeDisabled();
  await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Remove Pizza from cart", exact: true })
  ).toBeDisabled();
  await page.locator("form").dispatchEvent("submit");
  expect(posts).toBe(1);
  release();
  await expect(page.locator("#receipt")).toBeVisible();
});

for (const failure of ["server", "network"]) {
  test(`${failure} failure retains the order and reuses its reference on retry`, async ({
    page,
  }) => {
    const references = [];
    await page.route("**/*", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      references.push(new URLSearchParams(route.request().postData()).get("request-reference"));
      if (references.length > 1) return route.fulfill({ status: 200, body: "OK" });
      return failure === "server"
        ? route.fulfill({ status: 503, body: "Unavailable" })
        : route.abort();
    });
    await add(page).click();
    await fill(page);
    await send(page).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("could not confirm receipt");
    await expect(page.locator("#receipt")).toBeHidden();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Preview Test Customer");
    await expect(total(page)).toHaveText("Estimated subtotal: $14.00");
    await expect(send(page)).toBeEnabled();
    await send(page).click();
    await expect(page.locator("#receipt")).toBeVisible();
    expect(references[0]).toBe(references[1]);
  });
}

test("changed order contents get a new reference after failure", async ({ page }) => {
  const references = [];
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    references.push(new URLSearchParams(route.request().postData()).get("request-reference"));
    await route.fulfill({ status: 503 });
  });
  await add(page).click();
  await fill(page);
  await send(page).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await add(page).click();
  await send(page).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(references).toHaveLength(2);
  expect(references[0]).not.toBe(references[1]);
});

test("a timeout retains details and explains the uncertain outcome", async ({ page }) => {
  await page.clock.install();
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    // Leave the request outstanding until the application aborts it.
    await new Promise(() => {});
  });
  await add(page).click();
  await fill(page);
  await send(page).click();
  await expect(send(page)).toBeDisabled();
  await page.clock.fastForward(21000);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(send(page)).toBeEnabled();
  await expect(total(page)).toHaveText("Estimated subtotal: $14.00");
});

test("keyboard can add, change quantity, and enter checkout", async ({ page }) => {
  await add(page).focus();
  await page.keyboard.press("Enter");
  const increase = page.getByRole("button", { name: "Increase Pizza quantity", exact: true });
  await increase.focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Pizza quantity", { exact: true })).toHaveText("2");
  await expect(increase).toBeFocused();
  expect(await increase.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
    "solid"
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
});

for (const width of [320, 375, 768, 1280]) {
  test(`all items and checkout fit at ${width}px`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width, height: 800 });
    await page
      .locator(".menu-item-button-add")
      .evaluateAll((buttons) => buttons.forEach((button) => button.click()));
    await expect(page.locator(".cart-row")).toHaveCount(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.getByLabel("Name", { exact: true }).fill("Preview Test Customer");
    await page.getByLabel("Phone number", { exact: true }).fill("2025550100");
    await send(page).scrollIntoViewIfNeeded();
    const box = await send(page).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
    expect(
      await send(page).evaluate((element) => {
        const r = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })
    ).toBe(true);
    expect(pageErrors).toEqual([]);
  });
}

test("offers a no-JavaScript explanation", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator("noscript p")).toBeVisible();
  await expect(page.locator(".menu .menu-item")).toHaveCount(12);
  await expect(page.locator(".menu-item-button-add").first()).toBeDisabled();
  await expect(page.locator("form")).toBeHidden();
  await context.close();
});

test("offline submission has a clear recovery message without sending", async ({
  page,
  context,
}) => {
  await add(page).click();
  await fill(page);
  await context.setOffline(true);
  await send(page).click();
  await expect(page.getByRole("alert")).toContainText("You are offline");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Preview Test Customer");
  await expect(send(page)).toBeEnabled();
  await context.setOffline(false);
});

test("a blocked application module offers a reload instead of a broken checkout", async ({
  page,
}) => {
  await page.route(/\/assets\/app-[^/]+\.js$/, (route) => route.abort());
  await page.reload();
  await expect(page.locator("#app-status")).toContainText("We could not load the menu");
  await expect(page.locator("#app-status a")).toHaveText("reload the page");
  await expect(page.locator("form")).toBeHidden();
});

for (const code of [400, 429]) {
  test(`HTTP ${code} has a helpful error and retains the order`, async ({ page }) => {
    await page.route("**/*", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({ status: code });
    });
    await add(page).click();
    await fill(page);
    await send(page).click();
    await expect(page.getByRole("alert")).toContainText(
      code === 429 ? "Wait a moment" : "Check your details"
    );
    await expect(total(page)).toHaveText("Estimated subtotal: $14.00");
    await expect(send(page)).toBeEnabled();
  });
}
