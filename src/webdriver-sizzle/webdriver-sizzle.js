/*
 @param driver - a built driver instance
 @param selenium - the selenium module.
 very important that these are using the same code/version,
 b/c of the library's global control flow.
 */

module.exports = function (driver, selenium) {
    var path = require('path');
    var fs = require('fs');

    selenium = selenium || require('selenium-webdriver');

    if (!(driver.executeScript && driver.findElement && driver.findElements)) {
        throw new Error("Driver passed to webdriver-sizzle must implement executeScript(), findElement() and findElements().");
    }

    var sizzleCode = module.exports.sizzleCode || fs.readFileSync(path.join(__dirname, 'sizzle.min.js')).toString();
    module.exports.sizzleCode = sizzleCode;

    var checkSizzleExists = function () {
        return driver.executeScript(function () {
            return !!(window && window.$$$Sizzle$$$);
        });
    };

    var injectSizzleIfMissing = function (sizzleExists) {
        if (!sizzleExists) {
            return driver.executeScript("var module = {exports: {}};\n" + sizzleCode + "\nwindow.$$$Sizzle$$$ = module.exports;");
        }
    };

    var init = function () {
        return checkSizzleExists()
            .then(injectSizzleIfMissing);
    };

    var one = function (selector) {
        var finder;
        finder = function () {
            return init()
                .then(function () {
                    return driver.findElement(selenium.By.js(function (selector) {
                        return (window.$$$Sizzle$$$(selector) || [])[0];
                    }, selector));
                }).catch(function (err) {
                    throw new Error("Selector " + selector + " matches nothing : " + err.message);
                });
        };
        return driver.findElement(finder);
    };

    one.all = function (selector) {
        var finder;

        finder = function () {
            return init().then(function () {
                return driver.findElements(selenium.By.js(function (selector) {
                    return window.$$$Sizzle$$$(selector) || [];
                }, selector));
            }).catch(function (err) {
                throw new Error("Selector " + selector + " matches nothing : " + err.message);
            });
        };

        return driver.findElements(finder);
    };

    return one;
};
