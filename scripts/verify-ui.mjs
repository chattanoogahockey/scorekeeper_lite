import { chromium } from "@playwright/test";

const baseURL = process.argv[2] || "https://chattanoogaHockey.github.io/scorekeeper_lite/";

async function selectFirstOption(page, selectors) {
  for (const selector of selectors) {
    const handle = await page.$(selector);
    if (handle) {
      const values = await page.evaluate((select) => Array.from(select.options).map((o) => o.value), handle);
      const firstNonEmpty = values.find((value) => value);
      if (firstNonEmpty !== undefined) {
        await page.selectOption(selector, firstNonEmpty);
        return true;
      }
    }
  }
  return false;
}

async function fillTime(page) {
  const selectors = ["[data-field=\"time\"]", "#goal-time"];
  for (const selector of selectors) {
    const handle = await page.$(selector);
    if (handle) {
      await page.fill(selector, "17:00");
      return true;
    }
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const dialogs = [];
  const consoleMessages = [];
  const pageErrors = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Score a New Game" }).click();
  await page.locator(".game-item").first().click();
  await page.getByRole("heading", { name: "Record Attendance" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Start Scoring Game" }).click();
  await page.getByRole("heading", { name: /Goals/i }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Add Goal" }).click();
  await page.getByRole("heading", { name: "Add Goal Details" }).waitFor({ state: "visible" });

  await page.waitForFunction(() => {
    const modern = document.querySelectorAll('[data-field="player"] option');
    const legacy = document.querySelectorAll('#goal-player option');
    return (modern.length > 1) || (legacy.length > 1);
  });

  await selectFirstOption(page, ['[data-field="player"]', '#goal-player']);
  await selectFirstOption(page, ['[data-field="assist"]', '#goal-assist']);
  await fillTime(page);

  await page.getByRole("button", { name: /Add Goal/i }).click();
  await page.waitForTimeout(1000);

  await browser.close();
  console.log(JSON.stringify({ baseURL, dialogs, consoleMessages, pageErrors }, null, 2));
}

run().catch((error) => {
  console.error("Error during UI verification:", error);
  process.exitCode = 1;
});
