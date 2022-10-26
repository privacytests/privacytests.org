#/usr/local/bin/node test config/desktop.yaml --update
#/usr/local/bin/node test config/nightly.yaml --update
/usr/local/bin/node test config/desktop.yaml >> desktop-log.txt
/usr/local/bin/node test config/desktop.yaml --incognito --filename private >> private-log.txt
/usr/local/bin/node test config/nightly.yaml >> nightly-log.txt
/usr/local/bin/node test config/nightly.yaml --incognito --filename nightly-private --except=duckduckgo >> nightly-private-log.txt
/usr/local/bin/node test config/android.yaml >> android-log.txt
/usr/local/bin/node test config/iOS.yaml >> ios-log.txt
#/usr/local/bin/node test config/android-nightly.yaml >> android-nightly-log.txt

