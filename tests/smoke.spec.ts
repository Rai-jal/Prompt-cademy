import { test, expect } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const resolveLessonUrl = () => {
  const raw = process.env.E2E_LESSON_URL;
  if (!raw) {
    return null;
  }

  if (raw.startsWith("http")) {
    return raw;
  }

  return new URL(raw, baseURL).toString();
};

test.describe("Promptcademy smoke", () => {
  test("login → lesson → run prompt", async ({ page }) => {
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;
    const lessonUrl = resolveLessonUrl();

    test.skip(
      !email || !password || !lessonUrl,
      "Set E2E_EMAIL, E2E_PASSWORD and E2E_LESSON_URL before running the smoke test."
    );

    test.setTimeout(120_000);

    await page.goto(`${baseURL}/login`);
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);

    await Promise.all([
      page.waitForURL("**/dashboard", { timeout: 60_000 }),
      page.getByRole("button", { name: /Sign In/i }).click(),
    ]);

    await page.goto(lessonUrl!);
    const promptEditor = page.getByPlaceholder("Enter your prompt here...");
    await promptEditor.fill(
      `Playwright smoke test prompt @ ${new Date().toISOString()}`
    );

    const runButton = page.getByRole("button", { name: /Run Prompt/i });
    await runButton.click();

    await expect(page.getByText("AI Response")).toBeVisible({
      timeout: 120_000,
    });
  });
});
