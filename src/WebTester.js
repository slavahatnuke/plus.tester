"use strict";

module.exports = class WebTester {
    constructor(driverFactory) {
        this.driverFactory = driverFactory;
        this.driverPromise = null;

        this.driver = null;
        this.$ = null;

        this.children = [];

        this.webdriverSizzle = require('./webdriver-sizzle');

        this.options = {
            waitTimeout: 10000
        };
    }

    setup(options = {}) {
        this.options = Object.assign(this.options, options);
        return this;
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

    iSee(path) {
        return this
            .wait(() => this.find(path).then((elements) => !!elements.length))
            .catch((err) => Promise.reject(`I should see: '${path}' : ${err.message}`));
    }

    iDontSee(path) {
        return this
            .wait(() => this.find(path).then((elements) => !elements.length))
            .catch((err) => Promise.reject(`I should NOT see: '${path}' : ${err.message}`));
    }

    iSeeValue(path, value) {
        return this.iSee(path)
            .then(() => this.wait(() => this.get(path).getAttribute('value').then((x) => x == value)))
            .catch((err) => Promise.reject(`I should see value: '${value}' in '${path}' : ${err.message}`));
    }

    iDontSeeValue(path, value) {
        return this.wait(() => this.get(path).getAttribute('value').then((x) => x != value))
            .catch((err) => Promise.reject(`I should NOT see value: '${value}' in '${path}' : ${err.message}`));
    }

    iClick(path) {
        return this.iSee(path)
            .then(() => this.get(path).click())
            .catch((err) => Promise.reject(`I can't click on: '${path}' : ${err.message}`));
    }

    iType(path, value) {
        return this.iSee(path)
            .then(() => this.get(path).clear())
            .then(() => this.get(path).sendKeys(value));
    }

    iCount(path, n) {
        return this.wait(() => this.find(path).then((elements) => elements.length == n))
            .catch((err) => Promise.reject(`I should count: '${n}' elements in '${path}', found only '${n}'  : ${err.message}`));
    }

    iDontCount(path, n) {
        return this.wait(() => this.find(path).then((elements) => elements.length != n))
            .catch((err) => Promise.reject(`I should count: '${n}' elements in '${path}', found only '${n}'  : ${err.message}`));
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
