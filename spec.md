# browserprivacy.net specification

## Fingerprinting
We want to test for the following fingerprinting vulnerabilities:
* AudioContext fingerprinting
* Canvas fingerprinting
* window.innerWidth, window.innerHeight
* navigator.plugins, navigator.mimeTypes
* screen.width, screen.height
* window.screenX, window.screenY
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
* media devices (camera/microphone IDs)
* webgl
* keyboard layout
* locale
* accept-language
* system media queries
* browser version
* timezone to UTC
* gamepad API (disabled)
* device sensors
* webspeech api (disabled)
* webgl debug renderer info extension
* navigator.hardwareConcurrency
* site-specific zoom
* mediaerror.message
* network information api (connection type) + ontypechange event
* media statstics api
* gelocation (disabloed)
* screen.oritientation
* prefers-reduced-motion
* PointerEvents

## Supercookies
* document.cookie
* cookie header
* localStorage, sessionStorage
* broadcast channels
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
* TLS session tickets, session IDs
* site permissions
* blob URL
* mediaSource URI
* window.name
* referer
* favicon caching
* http auth
* isolate page info media previews to content first party (cache, network)
* favicons in tabs dropdown list (cache, network)
* CSS history
* caching through canvas? (see https://samy.pl/evercookie/)

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
* link rel=preconnect
* network preditor, speculative connect
* bare IP Addresses