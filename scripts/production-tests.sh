#/usr/local/bin/node test config/desktop.yaml --update
#/usr/local/bin/node test config/nightly.yaml --update
/usr/local/bin/node test config/desktop.yaml >> desktop-log.txt
/usr/local/bin/node test config/desktop.yaml --except=safari --incognito --filename private >> private-log.txt
/usr/local/bin/node test --browser=safari --incognito --filename=private-safari >> private-safari-log.txt
/usr/local/bin/node test --browser=brave --tor --repeat 5 --filename=brave-tor
/usr/local/bin/node test config/nightly.yaml >> nightly-log.txt
/usr/local/bin/node test config/nightly.yaml --incognito --filename nightly-private --except=safari,duckduckgo >> nightly-private-log.txt
/usr/local/bin/node test --browser=safari --incognito --nightly --filename=nightly-private-safari >> nightly-private-safari-log.txt
/usr/local/bin/node test --browser=brave --tor --repeat 5 --filename=brave-tor-nightly --nightly
#/usr/local/bin/node test config/android.yaml >> android-log.txt
#/usr/local/bin/node test config/iOS.yaml >> ios-log.txt
#/usr/local/bin/node test config/android-nightly.yaml >> android-nightly-log.txt

