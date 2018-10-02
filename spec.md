# browserprivacy.net specification

## Fingerprinting
We want to test for the following fingerprinting vulnerabilities:
* AudioContext fingerprinting
* Canvas fingerprinting
* window.innerWidth
* window.innerHeight
* navigator.plugins
* navigator.mimeTypes
* screen.width
* screen.height
* navigator.userAgent
* screen width and height media queries
* screen.availHeight
* screen.availWidth
* document.documentElement.width
* document.docuemntElement.height
* available fonts
* IP address from webrtc
* Date (locale, timezone, timing)
* Intl.NumberFormat (locale)
* Intl.DateTimeFormat (locale)
* performance.now()
* <input type="datetime"> (locale)
* camera/microphone IDs

## Supercookies
* document.cookie
* cookie header
* etag header
* HSTS cache
* HPKP cache
* OCSP cache
* AltSvc cache
* page cache
* image cache
* script cache
* fetch cache
* HTTP2 origin frame cache
* cache from fetch
* SharedWorker
* ServiceWorker
* indexeddb
* TLS session tickets
* TLS session IDs
* permissions
* blob URL
* window.name
* referer

## Tor/Proxy bypass
* Uses Tor
* Stream isolation by first party
* fetch
* follow link
* favicon
* speculative connect
* link prefetch
* subresources (css, img, script, iframe, video, audio, etc)
* webrtc
* page info
* save as
* web notifications

