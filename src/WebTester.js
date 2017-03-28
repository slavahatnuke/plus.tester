"use strict";

module.exports = class WebTester {
    constructor(driverFactory) {
        this.driverFactory = driverFactory;
        this.driverPromise = null;

        this.driver = null;
        this.$ = null;

        this.children = [];
        this.testers = {};

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

    iGetAttribute(css3selector, attribute) {
        return this.iSee(css3selector)
            .then(() => this.get(css3selector).getAttribute(attribute))
            .catch((err) => Promise.reject(`I get attribute: '${attribute}' in '${css3selector}' : ${err.message}`));
    }

    iFindAttribute(css3selector, attribute) {
        return this.iSee(css3selector)
            .then(() => this.find(css3selector))
            .then((elements) => Promise.all(elements.map((element) => element.getAttribute(attribute))))
            .catch((err) => Promise.reject(`I should find attributes: '${attribute}' in '${css3selector}' : ${err.message}`));
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

    waitUpTo(waitTimeout, promiseOrCreator) {
        let options = this.getOptions();

        return Promise.resolve()
            .then(() => this.setup({waitTimeout: waitTimeout}))
            .then(() => {
                if (promiseOrCreator instanceof Function) {
                    return promiseOrCreator();
                } else {
                    return promiseOrCreator;
                }
            })
            .then((result) => {
                this.setup(options);
                return result;
            });
    }

    setup(options = {}) {
        this.options = Object.assign(this.options, options);
        return this;
    }

    getOptions() {
        return Object.assign({}, this.options);
    }

    setOptions(options = {}) {
        this.setup(options);
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
        return Promise.resolve()
            .then(() => this.driver ? this.driver.quit() : null)
            .then(() => Promise.all(this.children.map((child) => child.stop())))
    }

    new() {
        let child = new WebTester(this.driverFactory).setup(this.options);
        this.children.push(child);
        return child;
    }


    applyTo(context) {
        let self = this;

        let names = [
            ...Object.getOwnPropertyNames(WebTester.prototype),
            ...Object.getOwnPropertyNames(Object.getPrototypeOf(self)),
            ...Object.getOwnPropertyNames(self),
            ...Object.keys(self)
        ];

        let parent = Object.getPrototypeOf(Object.getPrototypeOf(self));

        if (Object.prototype !== parent) {
            names = [...names, ...Object.getOwnPropertyNames(parent)];
        }

        names = [...new Set(names)];

        for (let name of names) {
            let method = self[name];

            if (method instanceof Function && !(method === WebTester)) {
                context[name] = (...args) => method.apply(this, args);
            }
        }
    }

    getTester(name) {
        return Promise.resolve()
            .then(() => {
                if (this.testers[name]) {
                    return this.testers[name];
                } else {
                    return this.new();
                }
            })
            .then((tester) => {
                this.testers[name] = tester;
                return tester;
            });
    }
};
