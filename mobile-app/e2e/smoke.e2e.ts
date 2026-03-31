/* eslint-disable jest/no-disabled-tests */
describe.skip('mobile detox smoke (scaffold)', () => {
  it('launches the app shell', async () => {
    await device.launchApp({ newInstance: true });
    await expect(element(by.text('PROACTIVE'))).toBeVisible();
  });
});
