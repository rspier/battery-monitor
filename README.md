# Battery Monitor

## Extension

Get it from the Chrome Web Store: https://chrome.google.com/webstore/detail/mceclipflnnklmpcljajjkeneghmiepn

### Configuration

Right click on the icon, choose options, and enter the name of the machine and
the URL of your server in the boxes.

To enable local low battery notifications, set a threshold.  Notifications will trigger when your battery reaches that threshold and every 10% thereafter.

## Server

The server receives POST messages from the extension and pushes them to a
[Prometheus Push Gateway](https://prometheus.io/docs/instrumenting/pushing/).

### Flags

```
Usage of ./server.bin:
  -port int
      port for http server to listen on (default 7088)
  -pushgateway string
      pushgateway address (default "localhost:9091")
```

If `-pushgateway` is empty, nothing will be pushed, but you can scrape the
`/metrics` endpoint.

## Example Rules

```yaml
groups:
  - name: battery
    rules:
      - record: last_updated_ago
        expr: time() - last_updated{job="battery-monitor"}
      - alert: BatteryLow
        expr: level{job="battery-monitor", instance="somehostname"} < 40 and on (instance) last_updated_ago{job="battery-monitor"} < 600
        for: 3m
        labels:
          severity: page
        annotations:
          summary: "{{ $labels.instance }} battery at {{ $value }}%"
```

## Security Caveat

By design, this extension regularly "phones home" to the URL specified in the configuration.  It has no default destinaton.  It could be abused by a bad actor to track someone's IP address or when they have their laptop unlocked.

## Disclaimer

This is not an official Google project.
