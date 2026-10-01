import { test, expect } from '@playwright/test';
test('two drivers share a room, drive, reconnect, and simulate latency', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#room=test-' + crypto.randomUUID().slice(0, 8));
  const other = await browser.newPage();
  await other.goto(page.url());
  await expect(page.locator('footer')).toContainText('2/8 drivers');
  await expect(other.locator('footer')).toContainText('2/8 drivers');
  await page.locator('canvas').click();
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => Number(await page.getByLabel('Car speed').textContent()))
    .toBeGreaterThan(20);
  await page.keyboard.up('ArrowUp');
  await page.reload();
  await expect(page.locator('footer')).toContainText('2/8 drivers');
  await page.getByText('Network & performance', { exact: true }).click();
  await page.getByLabel('Simulated round-trip delay').selectOption('200');
  await expect
    .poll(
      async () =>
        Number((await page.locator('footer').textContent())?.match(/(\d+) ms RTT/)?.[1] || 0),
      { timeout: 10000 },
    )
    .toBeGreaterThanOrEqual(180);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await other.close();
});

test('spectator watches a room without a driver seat and can join as a driver', async ({
  page,
  browser,
}) => {
  const room = 'watch-' + crypto.randomUUID().slice(0, 8);
  await page.goto('/#room=' + room);
  const watcher = await browser.newPage();
  await watcher.goto('/#room=' + room + '&watch=1');
  await expect(watcher.getByText('Watching live', { exact: true })).toBeVisible();
  await expect(watcher.locator('footer')).toContainText('1/8 drivers');
  await expect(page.locator('footer')).toContainText('1 watching');
  await expect(watcher.getByRole('button', { name: 'Reset car ↺' })).toHaveCount(0);
  await expect(watcher.getByRole('table', { name: 'Drivers' }).locator('tbody tr')).toHaveCount(1);
  await watcher.reload();
  await expect(watcher.locator('footer')).toContainText('1/8 drivers');
  await watcher.getByLabel('Room settings').click();
  await watcher.getByLabel('Join as').selectOption('driver');
  await watcher.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(watcher.locator('footer')).toContainText('2/8 drivers');
  await expect(watcher.getByRole('button', { name: 'Reset car ↺' })).toBeVisible();
  await watcher.close();
});
