import { test, expect } from "@playwright/test";

test.describe("math rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders inline math", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("The equation $E = mc^2$ is famous.");
    await page.waitForTimeout(500);

    // Check that math span is rendered
    const mathSpan = preview.locator("span.math-inline");
    await expect(mathSpan).toBeVisible();

    // Check that it contains an image with data URL
    const img = mathSpan.locator("img");
    await expect(img).toBeVisible();
    const src = await img.getAttribute("src");
    expect(src).toMatch(/^data:image\/svg\+xml/);
  });

  test("renders block math", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("$$\n\\int_0^1 x^2 dx\n$$");
    await page.waitForTimeout(500);

    // Check that math div is rendered
    const mathDiv = preview.locator("div.math-block");
    await expect(mathDiv).toBeVisible();

    // Check that it contains an image
    const img = mathDiv.locator("img");
    await expect(img).toBeVisible();
  });

  test("math preserves TeX source in data attribute", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("$x^2 + y^2 = z^2$");
    await page.waitForTimeout(500);

    const mathSpan = preview.locator("span.math");
    const dataTex = await mathSpan.getAttribute("data-tex");
    expect(dataTex).toBe("x^2 + y^2 = z^2");
  });

  test("does not render numbers as math", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("The price is $100$ dollars");
    await page.waitForTimeout(300);

    // Number-only patterns should not be rendered as math
    const mathElements = preview.locator(".math");
    await expect(mathElements).toHaveCount(0);
  });

  test("skips math inside code blocks", async ({ page }) => {
    const editor = page.locator("#markdownEditor");
    const preview = page.locator("#htmlPreview");

    await editor.fill("```\n$not math$\n```");
    await page.waitForTimeout(300);

    // Should not render math inside code fence
    const mathElements = preview.locator(".math");
    await expect(mathElements).toHaveCount(0);
  });
});
