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
        return this.iWaitInteraction(() => this.iSee(css3selector)
            .then(() => this.get(css3selector).click())
            .catch((err) => Promise.reject(`I can't click on: '${css3selector}' : ${err.message}`)));
    }

    iType(css3selector, value) {
        return this.iWaitInteraction(() => this.iSee(css3selector)
            .then(() => this.get(css3selector).clear())
            .then(() => this.get(css3selector).sendKeys(value)));
    }

    iCount(css3selector, n) {
        return this.wait(() => this.find(css3selector).then((elements) => elements.length == n))
            .catch((err) => Promise.reject(`I should count: '${n}' elements in '${css3selector}', found only '${n}'  : ${err.message}`));
    }

    iUseFrame(css2selector) {
        const {By} = require('selenium-webdriver');

        return this.getDriver()
            .then((driver) => {
                return Promise.resolve()
                    .then(() => driver.switchTo().frame(driver.findElement(By.css(css2selector))))
            });
    }

    iDontUseFrame() {
        return this.getDriver()
            .then((driver) => driver.switchTo().defaultContent());
    }

    iUseTab(tabIndex) {
        return this.getDriver()
            .then((driver) => {
                return Promise.resolve()
                    .then(() => driver.getAllWindowHandles())
                    .then((tabs) => {
                        if (!tabs[tabIndex]) {
                            return Promise.reject(new Error('Tab has not been found'));
                        }

                        return driver.switchTo().window(tabs[tabIndex]);
                    });
            });
    }

    iWaitInteraction(promiseCreator) {
        let timeout = this.options.waitTimeout;
        let waitingPeriod = parseInt(timeout / 20) || 100;

        let gotResult = false;
        let resultError = false;

        let timeoutTimer = null;
        let periodInterval = null;
        let working = false;

        let check = () => {
            return Promise.resolve()
                .then(() => promiseCreator instanceof Function ? promiseCreator() : promiseCreator)
                .then(() => gotResult = true)
                .catch((err) => {
                    resultError = err;
                    gotResult = false;
                    return gotResult;
                })
        };

        let waitFor = () => {
            let stop = () => {
                timeoutTimer && clearTimeout(timeoutTimer);
                periodInterval && clearInterval(periodInterval);
            };

            return new Promise((resolve, reject) => {
                periodInterval = setInterval(() => {
                    if (!working) {
                        working = true;
                        Promise.resolve()
                            .then(() => check())
                            .then(() => {
                                if (gotResult) {
                                    resolve();
                                }
                            })
                            .then(() => working = false)
                            .catch(() => working = false);
                    }
                }, waitingPeriod);

                timeoutTimer = setTimeout(() => {
                    let error = resultError || 'No result';

                    reject(new Error(`Exceeded interaction timeout ${timeout}ms : ${error}`));
                }, timeout);
            })

                .then(() => stop())
                .catch((err) => {
                    stop();
                    return Promise.reject(err);
                });
        };

        return Promise.resolve()
            .then(() => {
                return Promise.resolve()
                    .then(() => check())
                    .then(() => gotResult || waitFor());
            })
    }

    iWaitReload(promiseCreator, timeout, reloadPeriod = 1000) {
        let gotResult = false;
        let resultError = false;

        let timeoutTimer = null;
        let periodInterval = null;
        let working = false;

        let check = () => {
            return Promise.resolve()
                .then(() => promiseCreator instanceof Function ? promiseCreator() : promiseCreator)
                .then(() => gotResult = true)
                .catch((err) => {
                    resultError = err;
                    gotResult = false;
                    return gotResult;
                })
        };

        let waitFor = () => {
            let stop = () => {
                timeoutTimer && clearTimeout(timeoutTimer);
                periodInterval && clearInterval(periodInterval);
            };

            return new Promise((resolve, reject) => {
                periodInterval = setInterval(() => {
                    if (!working) {
                        working = true;
                        this.iReload()
                            .then(() => check())
                            .then(() => {
                                if (gotResult) {
                                    resolve();
                                }
                            })
                            .then(() => working = false)
                            .catch(() => working = false);
                    }
                }, reloadPeriod);

                timeoutTimer = setTimeout(() => {
                    let error = resultError || 'No result';

                    reject(new Error(`Exceeded reload timeout ${timeout}ms : ${error}`));
                }, timeout);
            })

                .then(() => stop())
                .catch((err) => {
                    stop();
                    return Promise.reject(err);
                });
        };

        return this.waitUpTo(reloadPeriod, () => {
            return Promise.resolve()
                .then(() => {
                    return Promise.resolve()
                        .then(() => check())
                        .then(() => gotResult || waitFor());
                });
        });

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

    find(path) {
        return this.$.all(path);
    }

    get(path) {
        return this.$(path);
    }

    wait(waitAcceptor) {
        return this.getDriver().then((driver) => driver.wait(waitAcceptor, this.options.waitTimeout));
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
