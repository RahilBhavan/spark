import { test, expect } from "@playwright/test";

test("landing page has Dashboard link and navigates to dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /SPARK.*BTC/i })
  ).toBeVisible();
  await page.getByRole("link", { name: /Dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByText(/Snapshot|No channel data|Loading/i)
  ).toBeVisible();
});
