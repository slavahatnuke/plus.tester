/// features/step_definitions/google.js
let {defineSupportCode} = require('cucumber');

defineSupportCode(function({Given, When, Then}) {
    Given('I open google', function () {
        return this.iVisit('http://google.com');
    });

    Then('I see search line', function () {
        return this.iSee('input');
    });

    Then('I type {stringInDoubleQuotes}', function (stringInDoubleQuotes) {
        return this.iType('input', stringInDoubleQuotes);
    });


    Then('I sleep {int}', function (int) {
        return new Promise((resolve, reject) => setTimeout(resolve, int));
    });

    Then('I click Lucky button', function () {
        return this.iClick(`input[name="btnI"]`);
    });



});