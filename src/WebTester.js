"use strict";

module.exports = class WebTester {
    constructor(driverFactory) {
        this.driverFactory = driverFactory;
        this.driverPromise = null;

        this.driver = null;
        this.$ = null;

        this.children = [];

        this.webdriverSizzle = require('plus.webdriver-sizzle');

        this.options = {
            waitTimeout: 10 * 1000
        };
    }

    iOpen(url) {
        return this.getDriver().then((driver) => driver.get(url));
    }

    iVisit(url) {
        return this.iOpen(url);
    }

    iReload() {
        return this.getDriver().then((driver) => driver.navigate().refresh());
    }

    iSee(css3selector) {
        return this
            .wait(() => this.find(css3selector).then((elements) => !!elements.length))
            .catch((err) => Promise.reject(`I should see: '${css3selector}' : ${err.message}`));
    }

    iDontSee(css3selector) {
        return this
            .wait(() => this.find(css3selector).then((elements) => !elements.length))
            .catch((err) => Promise.reject(`I should NOT see: '${css3selector}' : ${err.message}`));
    }

    iSeeValue(css3selector, value) {
        return this.iSee(css3selector)
            .then(() => this.wait(() => this.get(css3selector).getAttribute('value').then((x) => x == value)))
            .catch((err) => Promise.reject(`I should see value: '${value}' in '${css3selector}' : ${err.message}`));
    }

    iDontSeeValue(css3selector, value) {
        return this.wait(() => this.get(css3selector).getAttribute('value').then((x) => x != value))
            .catch((err) => Promise.reject(`I should NOT see value: '${value}' in '${css3selector}' : ${err.message}`));
    }

    iClick(css3selector) {
        return this.iSee(css3selector)
            .then(() => this.get(css3selector).click())
            .catch((err) => Promise.reject(`I can't click on: '${css3selector}' : ${err.message}`));
    }

    iType(css3selector, value) {
        return this.iSee(css3selector)
            .then(() => this.get(css3selector).clear())
            .then(() => this.get(css3selector).sendKeys(value));
    }

    iCount(css3selector, n) {
        return this.wait(() => this.find(css3selector).then((elements) => elements.length == n))
            .catch((err) => Promise.reject(`I should count: '${n}' elements in '${css3selector}', found only '${n}'  : ${err.message}`));
    }

    setup(options = {}) {
        this.options = Object.assign(this.options, options);
        return this;
    }

    getDriver() {
        if (!this.driverPromise) {
            this.driverPromise = Promise.resolve()
                .then(() => {
                    if (this.driver) {
                        return this.driver;
                    } else {
                        return Promise.resolve()
                            .then(() => {
                                if (this.driverFactory instanceof Function) {
                                    return this.driverFactory();
                                }

                                return Promise.reject(new Error('No driver factory'));
                            })
                            .then((driver) => {
                                this.driver = driver;
                                this.$ = this.$ || this.webdriverSizzle(this.driver);
                                return this.driver;
                            })
                    }
                })
                .then(() => {
                    this.driverPromise = null;
                    return this.driver;
                });
        }

        return this.driverPromise;
    }

    applyTo(context) {
        let self = this;

        for (let name of Object.getOwnPropertyNames(Object.getPrototypeOf(self))) {
            let method = self[name];

            if (method instanceof Function && !(method === WebTester)) {
                context[name] = (...args) => method.apply(this, args);
            }
        }
    }

    find(path) {
        return this.$.all(path);
    }

    get(path) {
        return this.$(path);
    }

    wait(wait) {
        return this.getDriver().then((driver) => driver.wait(wait, this.options.waitTimeout));
    }

    stop() {
        return this.getDriver()
            .then((driver) => driver.quit())
            .then(() => Promise.all(this.children.map((child) => child.stop())));
    }

    new() {
        let child = new WebTester(this.driverFactory).setup(this.options);
        this.children.push(child);
        return child;
    }
};
