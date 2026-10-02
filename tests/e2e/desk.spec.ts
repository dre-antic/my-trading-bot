import { expect, test } from "@playwright/test";

test("operator can login and reach the desk", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@local");
  await page.getByLabel("Password").fill("CommandCenter!demo");
  await page.getByRole("button", { name: "Enter desk" }).click();
  await expect(page.getByRole("heading", { name: "Desk overview" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("LIVE off")).toBeVisible();
  await page.goto("/opportunities");
  await page.getByRole("button", { name: "Scan educational strategies" }).click();
  await expect(page.getByText("SPY").first()).toBeVisible({ timeout: 20_000 });
  await page.goto("/terminal");
  await expect(page.getByRole("heading", { name: "Market Watch" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Buy by Market" }).click();
  await expect(page.getByText(/paper buy SPY/i)).toBeVisible({ timeout: 20_000 });
});
