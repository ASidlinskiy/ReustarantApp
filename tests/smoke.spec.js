import { test, expect } from "@playwright/test";

test.describe("menu", () => {
  test("renders each menu item exactly once", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".menu .menu-item")).toHaveCount(12);
  });

  test("has a page title and meta description", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Al's Diner/);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toBeTruthy();
  });

  test("has no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });
});

test.describe("cart", () => {
  test("is hidden until an item is added, then shows the right item and total", async ({
    page,
  }) => {
    await page.goto("/");
    const cart = page.locator(".menu-item-selected");
    await expect(cart).toBeHidden();

    const addButtons = page.locator(".menu-item-button-add");
    await addButtons.first().click();

    await expect(cart).toBeVisible();
    const row = page.locator(".menu-item-form-cart .row").first();
    await expect(row.locator(".menu-item-form-cart-name")).not.toBeEmpty();
    await expect(page.locator(".menu-item-selected-order-total")).toHaveText("Total: $14");
  });

  test("totals correctly across multiple adds, and removing updates both the list and the total", async ({
    page,
  }) => {
    await page.goto("/");
    const addButtons = page.locator(".menu-item-button-add");

    await addButtons.nth(0).click(); // Pizza $14
    await addButtons.nth(1).click(); // Cheeseburger $12
    await expect(page.locator(".menu-item-selected-order-total")).toHaveText("Total: $26");
    await expect(page.locator(".menu-item-form-cart .row")).toHaveCount(2);

    await page.locator(".menu-item-form-cart-btn").first().click();
    await expect(page.locator(".menu-item-form-cart .row")).toHaveCount(1);
    await expect(page.locator(".menu-item-selected-order-total")).toHaveText("Total: $12");
  });

  test("un-adding the last item hides the cart again", async ({ page }) => {
    await page.goto("/");
    const addButton = page.locator(".menu-item-button-add").first();
    await addButton.click();
    await addButton.click(); // toggle off
    await expect(page.locator(".menu-item-selected")).toBeHidden();
  });

  test("submitting the order does not reload the page or lose the cart before confirming", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".menu-item-button-add").first().click();
    await page.locator('button[type="submit"]').click();

    // no navigation happened
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".menu-item-form h2")).toHaveText(/Thanks/i);
    await expect(page.locator(".menu-item-form-cart .row")).toHaveCount(0);
  });
});
