(ns site.core
  (require [hiccup.page]
           [clojure.java.io]
           [clojure.data.json :as json]))

(defn load-results []
  (slurp "../selenium/results/results_20180705_000406.json"))

(defonce results1 (json/read-str (load-results) :key-fn keyword))

(defn compress-css
  [css-string]
  (clojure.string/replace css-string #"\s+" " "))

(defn html-table [header-data body-data]
  [:table.comparison-table
   (when header-data
     [:tr
      (for [header-datum header-data] [:th header-datum])])
   (for [row body-data]
     [:tr
      (for [item row]
        [:td item])])])


(defn capabilities-to-description
  [{:keys [os os_version browser browser_version device]}]
  (if browser_version
    (str browser " " browser_version ", " os " " os_version)
    (str os " " os_version ", " device)))

(defn fingerprinting-map [row-names fingerprinting-result]
   (into {}
         (for [item fingerprinting-result]
           [(:expression item) item])))

(defn results-to-table
  [raw-results]
  (let [best-results (filter :fingerprintingResults raw-results)
        headers (->> best-results
                     (map :capabilities)
                     (map capabilities-to-description))
        row-names (map :expression (:fingerprintingResults (first best-results)))
        fingerprinting-maps (map #(fingerprinting-map row-names %) (map :fingerprintingResults best-results))
        body (for [row-name row-names]
               (cons row-name
                 (for [fingerprinting-map fingerprinting-maps]
                   (let [test-result (fingerprinting-map row-name)
                         description (clojure.string/join
                                      "\n"
                                      (for [[k v] test-result]
                                        (str (name k) ": " v)))]
                     (if (:passed test-result)
                       [:span.good {:title description} "&#x2714;"]
                       [:span.bad {:title description} "&#x00D7;"])
                     ))))]
    [(cons nil headers) body]))

(defn write-page
  "Writes hiccup data to an html file."
  [filename hiccup-data]
  (do
    (clojure.java.io/make-parents "./out/,")
    (spit (str "./out/" filename)
          (hiccup.page/html5 hiccup-data))))

(defn -main
  "Main program."
  [& args]
  (write-page "index.html"
              (list
              [:head
               [:title "Browser Privacy "]
               [:meta {:charset "utf-8"}]
               [:style {:type "text/css"} (compress-css (slurp "main.css"))]]
              [:body
               [:h2 "Browser fingerprinting comparison"]
               (let [[header body] (results-to-table results1)]
                 (html-table header body))
               ; data-table [1 2 3][[:a :b :c ] [:d :e :f]])
              ])))

(-main)
