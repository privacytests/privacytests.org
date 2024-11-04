/usr/local/bin/node test config/desktop.yaml --update
/usr/local/bin/node test config/nightly.yaml --update
/usr/local/bin/node test config/desktop.yaml
/usr/local/bin/node test config/desktop.yaml --incognito --filename private
/usr/local/bin/node test --browser=brave --tor --repeat 5 --filename=brave-tor
/usr/local/bin/node test config/nightly.yaml
/usr/local/bin/node test config/nightly.yaml --incognito --filename nightly-private --except=duckduckgo
/usr/local/bin/node test --browser=brave --tor --repeat 5 --filename=brave-tor-nightly --nightly
/usr/local/bin/node test config/android.yaml
/usr/local/bin/node test config/iOS.yaml

