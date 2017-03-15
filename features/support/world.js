// features/support/world.js
const {defineSupportCode} = require('cucumber');

function CustomWorld() {
    let {WebTester} = require('../../src');

    const seleniumWebdriver = require('selenium-webdriver');

    this.tester = new WebTester(() => new seleniumWebdriver.Builder().forBrowser('chrome').build());
    this.tester.setup({ waitTimeout: 20 * 1000});

    this.tester.getDriver()
        .then((driver) => driver.manage().timeouts().pageLoadTimeout(30 * 1000));

    this.tester.applyTo(this);
}

defineSupportCode(({setWorldConstructor, setDefaultTimeout}) => {
    setDefaultTimeout(60 * 1000);
    setWorldConstructor(CustomWorld)
});