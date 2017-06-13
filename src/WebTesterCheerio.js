module.exports = class WebTesterCheerio {
    constructor() {
        this.$ = null;

        this.children = [];
        this.testers = {};

        this.options = {
            waitTimeout: 10 * 1000
        };

        this.url = null;

        this.cheerio = require('cheerio');
        this.request = require('request-promise');
        this.URL = require('url');
    }

    iOpen(url) {
        return Promise.resolve()
            .then(() => {
                const options = {
                    uri: url,
                    transform: (body) => this.cheerio.load(body)
                };

                return this.request(options)
                    .then(($) => this.$ = $)
                    .then(() => this.url = url);
            })
    }

    iVisit(url) {
        return this.iOpen(url);
    }

    iReload() {
        return this.iOpen(this.url);
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
            .then(() => this.wait(() => this.get(css3selector).then((element) => this.$getAttr(element, 'value')).then((x) => x == value)))
            .catch((err) => Promise.reject(`I should see value: '${value}' in '${css3selector}' : ${err.message}`));
    }

    iDontSeeValue(css3selector, value) {
        return this.wait(() => this.get(css3selector).then((element) => this.$getAttr(element, 'value')).then((x) => x != value))
            .catch((err) => Promise.reject(`I should NOT see value: '${value}' in '${css3selector}' : ${err.message}`));
    }

    iGetAttribute(css3selector, attribute) {
        return this.iSee(css3selector)
            .then(() => this.get(css3selector).then((element) => this.$getAttr(element, attribute)))
            .catch((err) => Promise.reject(`I get attribute: '${attribute}' in '${css3selector}' : ${err.message}`));
    }

    iFindAttribute(css3selector, attribute) {
        return this.iSee(css3selector)
            .then(() => this.find(css3selector))
            .then((elements) => Promise.all(elements.map((element) => this.$getAttr(element, attribute))))
            .catch((err) => Promise.reject(`I should find attributes: '${attribute}' in '${css3selector}' : ${err.message}`));
    }

    $getAttr(element, attribute) {
        switch (attribute) {
            case 'innerText':
                return element.text();

            case 'innerHTML':
                return element.html();

            default:
                return element.attr(attribute);
        }
    }

    iClick(css3selector) {
        return this.iWaitInteraction(() => this.iSee(css3selector)
            .then(() => this.iGetAttribute(css3selector, 'href'))
            .catch((err) => Promise.reject(`I can't click on: '${css3selector}' : ${err.message}`)))
            .then((url) => this.URL.resolve(this.url, url))
            .then((url) => {
                return this.iOpen(url)
                    .catch((err) => Promise.reject(`I can't open URL: '${url}' : ${err.message}`));
            })

    }

    iType(css3selector, value) {
        return Promise.reject(new Error(`Does not support: ${css3selector} : ${value}`));
    }

    iCount(css3selector, n) {
        return this.wait(() => this.find(css3selector).then((elements) => elements.length == n))
            .catch((err) => Promise.reject(`I should count: '${n}' elements in '${css3selector}', found only '${n}'  : ${err.message}`));
    }

    iUseFrame(css2selector) {
        return Promise.reject(new Error(`Does not support: ${css2selector}`));
    }

    iDontUseFrame() {
        return Promise.reject(new Error(`Does not support`));
    }

    iUseTab(tabIndex) {
        return Promise.reject(new Error(`Does not support`));
    }

    iWaitInteraction(promiseCreator) {
        return Promise.resolve()
            .then(() => promiseCreator instanceof Function ? promiseCreator() : promiseCreator);
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
        return Promise.reject(new Error('Does not support'));
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
        const items = [];
        const self = this;

        this.$(path).map(function (i, element) {
            items.push(self.$(element))
        });

        return Promise.resolve(items);
    }

    get(path) {
        return this.find(path)
            .then((items) => items.length ? items[0] : null);
    }

    wait(waitAcceptor) {
        return Promise.resolve(waitAcceptor())
            .then((found) => found ? Promise.resolve() : Promise.reject(new Error('No result')));
    }

    stop() {
        return Promise.resolve()
            .then(() => Promise.all(this.children.map((child) => child.stop())));
    }

    new() {
        let child = new WebTesterCheerio().setup(this.options);
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
