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

To run tests, point to a .yaml file:

`node test config/desktop.yaml`

Config files are YAML arrays. Each item in the array is an object
that describes what should go into a single test. All parameters
are optional, except `browser`:

```
browsers:                # Possible values include chrome, firefox, brave, opera, edge, vivaldi, etc.
  - chrome
  - firefox
  - brave
  - edge
android: false,          # Set to true to run on Android platform (default: false)
ios: false,              # Set to true to run on iOS platform (default: false)
incognito: false,        # Set incognito to true for testing private browsing windows. (default: false)
tor: true                # Set tor to true for 'Brave Private Window with Tor.' (default: false)
repeat: 5                # Integer, how many times we should repeat this test (default: 1)
aggregate: true          # Whether to combine repeated runs of a browser into a single column (default: true)
debug: false             # Whether to leave browsers open after test is done (default: false)
app-dir: /path/to/apps   # On desktop, set where browsers are located (default: "/Applications/")
filename: my-results     # Specifies the filename prefix for results (defaults to time run)
out: ./results.json      # Specifies a full path for output results (overrides filename)
```

You can also use these flags on the command line, to supplement the yaml file or instead of one:

* `--browsers chrome,firefox,vivaldi`: use the specified browsers, separated by commas
* `--android`: Add flag to run on Android
* `--ios`: Add flag to run on iOS
* `--incognito`: Run tests in private browsing windows
* `--tor`: Run test in Tor windows (available in Brave)
* `--repeat 10`: repeat the whole set of tests 10 times
* `--aggregate`: Combine results from the same browser into a single column (enabled by default)
* `--debug`: Don't close browser(s) after test is done
* `--app-dir=/path/to/apps`: Use to point to directory containing browsers (default: `/Applications/`)
* `--filename=my-results`: Use this flag to specify a filename prefix for the results files.
* `--out=./results.json`: Use this flag to specific a full path for the results file.
* `--categories=misc,https`: Limit tests to certain categories. Possible values: `main`, `supplementary`, `misc`, `https`. If this flag is omitted, all categories are run.

So for example,
`node test config/my-config.yaml --repeat=5 --filename=temp`
runs the given config, but repeats tests for each browser 5 times and writes the results to temp*

## Development

To hack on the code, and get fast feedback, use:

`npm run develop`

When you run browser tests, when they complete the /results.html page will be updated. If you save a change to render.js, the page will also be updated.

