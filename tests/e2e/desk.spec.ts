import { expect, test } from "@playwright/test";
import path from "node:path";

test("operator can login, paper-trade, and ingest a strategy file", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@local");
  await page.getByLabel("Password").fill("CommandCenter!demo");
  await page.getByRole("button", { name: "Enter desk" }).click();
  await expect(page.getByRole("heading", { name: "Market Watch" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("LIVE off").first()).toBeVisible();
  await page.getByRole("button", { name: "Buy by Market" }).click();
  await expect(page.getByText("paper buy EURUSD · filled", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /New… \(audio, video, file\)/ }).click();
  await page.getByLabel("Strategy file").setInputFiles(path.join(process.cwd(), "tests/fixtures/rsi-mean-reversion.md"));
  await expect(page.getByRole("button", { name: /Confirm and attach to EURUSD/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Confirm and attach to EURUSD/ }).click();
  await expect(page.getByText(/attached to EURUSD/i).first()).toBeVisible({ timeout: 20_000 });
});
