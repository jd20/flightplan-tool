const Searcher = require("../../Searcher");

const { errors } = Searcher;

module.exports = class extends Searcher {
  async isLoggedIn(page) {
    // Sometimes the page keeps reloading out from under us
    return this.retry(async () => {
      try {
        await page.waitFor(1000);
        await page.waitFor(".logged-in-container", { timeout: 5000 });
      } catch (err) {}
      return !!(await page.$(".logged-in-container"));
    });
  }

  async login(page, credentials) {
    const [username, password] = credentials;
    if (!username || !password) {
      throw new errors.MissingCredentials();
    }

    page.goto("https://www.delta.com/login/loginPage?staticurl=");

    // Enter username and password
    await page.waitFor(".loginContentBody", { timeout: 5000 });
    await page.waitFor(1000);
    await this.enterText("#userId", username);
    await this.enterText("#password", password);
    await page.waitFor(2500);

    // Check remember box, and submit the form
    // if (!(await page.$("#rememberMe:checked"))) {
    //   await page.click("#persistentLogin_CheckBox");
    //   await page.waitFor(250);
    // }
    await this.clickAndWait(".loginButton");
  }

  async search(page, query, results) {
    const { oneWay, fromCity, toCity, quantity } = query;
    const departDate = query.departDateMoment();
    const returnDate = query.returnDateMoment();

    // // Wait for results to load
    this.info("Submitting search form");
    // await this.settle();
    const returnDateStr = oneWay ? "" : returnDate.format("MM/DD/YYYY");
    const departDateStr = departDate.format("MM/DD/YYYY");
    const selectTripType = oneWay ? "ONE_WAY" : "ROUND_TRIP";
    this.info(`oneWay ${oneWay}`);
    this.info(`returnDate ${returnDate}`);
    this.info(`returnDateStr ${returnDateStr}`);
    this.info(`departDateStr ${departDateStr}`);
    await page.evaluate(
      (
        fromCity,
        toCity,
        departDateStr,
        returnDateStr,
        selectTripType,
        quantity
      ) => {
        request = {
          airports: {
            fromCity: fromCity,
            toCity: toCity,
            fromAirportcode: fromCity,
            toAirportcode: toCity,
            invalidAirportCodes: null
          },
          selectTripType: selectTripType,
          dates: {
            departureDate: departDateStr,
            returnDate: returnDateStr,
            chkFlexDate: false
          },
          passenger: quantity.toString(),
          swapedFromCity: null,
          swapedToCity: null,
          schedulePrice: "miles",
          flightHotelDeals: false,
          faresFor: "BE",
          meetingEventCode: "",
          refundableFlightsOnly: null,
          nearbyAirports: false,
          deltaOnly: "off",
          awardTravel: true,
          departureTime: "AT",
          returnTime: "AT",
          adtGbeCount: null,
          infantCount: null,
          maxPaxCount: null,
          adtCount: null,
          cnnCount: null,
          gbeCount: null,
          chkFlexDate: false
        };
        var data = {
          method: "POST",
          body: JSON.stringify(request),
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json; charset=UTF-8"
          }
        };
        fetch(
          "https://www.delta.com/prefill/updateSearch?searchType=RecentSearchesJSON",
          data
        );
      },
      fromCity,
      toCity,
      departDateStr,
      returnDateStr,
      selectTripType,
      quantity
    );

    // then go here
    // submit button
    page.goto("https://www.delta.com/flight-search-2/book-a-flight");
    await page.waitFor(3000);

    // Uncheck flexible dates since we want to see specific dates
    console.log("Unchecking things");
    await page.evaluate(form => {
      console.log("Unchecking things");
      $("#chkFlexDate").attr("disabled", false);
      $("#chkFlexDate").click();
    });
    await page.waitFor(3000);

    await page.click("#btnSubmit");
    await this.settle();
    // // Save the results
    await results.saveHTML("results");
  }

  async settle() {
    const { page } = this;

    while (true) {
      try {
        await Promise.race([
          page.waitFor(".flightcardtable", {
            timeout: 120000
          }),
          page.waitFor(".errorTextSummary", {
            timeout: 120000
          })
        ]);
      } catch (err) {
        throw new Searcher.Error(`Stuck waiting for results to appear`);
      }

      break;
    }
  }
};
