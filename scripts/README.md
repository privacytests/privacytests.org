# PrivacyTests.org tests

This directory includes scripts to run browser privacy tests (fingerprinting resistance, partitioning between websites, etc.), save the results to a JSON file, and render those results in web pages.

## Set up

PrivacyTests can run tests on browser on Mac, Linux (partial), iOS and Android. Depending on the platform, you will need to install a few things.

### On Mac

```
brew install mkcert
mkcert -install
```

You may need to set Settings > Privacy & Security > Full Disk Access > Terminal > (enabled)

### On Linux

`sudo apt-get install libpng-dev libxtst-dev libx11-dev`

### iOS

You will need to use a Mac to run iOS tests. On the command line, enter:

```
brew install ideviceinstaller
```

### Android

```
brew cask install android-platform-tools
```

### Finally

On all platforms:

`npm install`

You're ready to go!

## Usage

Run tests with command-line flags. `--browser` is required:

`node test --browser=firefox --out=../firefox.json`

Options:

* `--browser=firefox`: the browser to test (chrome, firefox, brave, opera, edge, vivaldi, etc.)
* `--android`: run on Android
* `--ios`: run on iOS
* `--incognito`: run tests in private browsing windows
* `--tor`: run in Tor windows (Brave)
* `--nightly`: use nightly browser builds where applicable
* `--aggregate`: combine results in the rendered output (enabled by default)
* `--debug`: don't close the browser after the test is done
* `--app-dir=/path/to/apps`: directory containing browsers (default: `/Applications/`)
* `--filename=my-results`: filename prefix for results files
* `--out=./results.json`: full path for the results JSON file
* `--categories=misc,https`: limit test categories (`main`, `supplementary`, `misc`, `https`, `session`, `trackingCookies`, `dns`)
* `--skip=dns`: skip test categories
* `--hurry`: skip the 60s feature-flag warmup on desktop
* `--update`: update all installed desktop browsers
* `--kill`: quit all desktop browsers
* `--versions`: print installed browser versions

For example:

`node test --browser=firefox --filename=temp`

writes results to `temp*`

## Development

To hack on the code, and get fast feedback, use:

`npm run develop`

When you run browser tests, when they complete the /results.html page will be updated. If you save a change to render.js, the page will also be updated.

