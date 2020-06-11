// server receives events from the battery-monitor chrome extension and exposes
// or pushes them to Prometheus.
package main

/*
Copyright 2020 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import (
	"flag"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/prometheus/client_golang/prometheus/push"
	"k8s.io/apimachinery/pkg/util/json"
)

var (
	port        = flag.Int("port", 7088, "port for http server to listen on")
	pushGateway = flag.String("pushgateway", "localhost:9091", "pushgateway address")
)

/*        hostname: localStorage.getItem("hostname"),
charging: battery.charging,
chargingTime: battery.chargingTime,
dischargingTime: battery.dischargingTime,
level: battery.level * 100,
*/
// https://stackoverflow.com/questions/48050945/how-to-unmarshal-json-into-durations
type batteryStatus struct {
	Hostname        string `json:"hostname"`
	Charging        bool   `json:"charging"`
	ChargingTime    int64  `json:"chargingTime"`
	DischargingTime int64  `json:"dischargingTime"`
	Level           int8   `json:"level"`
}

// We could clean up old vec entries, but it's hard to analyze the "last seen"
// value in prometheus, easier to filter it out later.

var (
	charging = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "charging",
			Help: "charging",
		},
		[]string{"instance"},
	)
	dischargingTime = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "dischargingTime",
			Help: "dischargingtime",
		},
		[]string{"instance"},
	)
	chargingTime = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "chargingTime",
			Help: "chargingtime",
		},
		[]string{"instance"},
	)
	chargeLevel = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "level",
			Help: "charge level",
		},
		[]string{"instance"},
	)
	lastUpdate = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "last_updated",
			Help: "timestamp of last update",
		},
		[]string{"instance"},
	)
)

func defaultHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		postHandler(w, r)
		return
	}
	w.Write([]byte("🔋"))
}

// lastEvent resends the last event, useful for bootstrapping.
func postHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")

	defer r.Body.Close()
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var s batteryStatus
	err = json.Unmarshal(body, &s)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("%+v", s)

	var g prometheus.Gauge
	g, _ = chargeLevel.GetMetricWithLabelValues(s.Hostname)
	g.Set(float64(s.Level))

	g, _ = chargingTime.GetMetricWithLabelValues(s.Hostname)
	g.Set(float64(s.ChargingTime))
	g, _ = dischargingTime.GetMetricWithLabelValues(s.Hostname)
	g.Set(float64(s.DischargingTime))

	g, _ = charging.GetMetricWithLabelValues(s.Hostname)
	if s.Charging {
		g.Set(1.0)
	} else {
		g.Set(0.0)

	}

	g, _ = lastUpdate.GetMetricWithLabelValues(s.Hostname)
	now := time.Now().Unix()
	g.Set(float64(now))

	if *pushGateway != "" {
		// Grouping("instance", "hostname")
		err := push.New(*pushGateway, "battery-monitor").Gatherer(prometheus.DefaultGatherer).Push()
		if err != nil {
			log.Printf("error pushing to %q: %v\n", *pushGateway, err)
		}
	}

}

func main() {
	flag.Parse()

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/post", postHandler)
	http.HandleFunc("/", defaultHandler)

	log.Printf("listening on port %d", *port)
	log.Fatal(http.ListenAndServe(":"+strconv.Itoa(*port), nil))
}
