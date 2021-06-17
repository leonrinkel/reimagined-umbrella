# reimagined-umbrella

[![](https://img.shields.io/npm/v/reimagined-umbrella)](https://www.npmjs.com/package/reimagined-umbrella)
[![](https://img.shields.io/librariesio/release/npm/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/network/dependencies)
[![](https://img.shields.io/github/issues/leonrinkel/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/issues)
[![](https://img.shields.io/github/license/leonrinkel/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/blob/main/LICENSE)
[![](https://img.shields.io/github/contributors/leonrinkel/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/graphs/contributors)
[![](https://img.shields.io/github/workflow/status/leonrinkel/reimagined-umbrella/Node.js%20CI/main)](https://github.com/leonrinkel/reimagined-umbrella/actions/workflows/node.js.yml)
[![](https://img.shields.io/github/workflow/status/leonrinkel/reimagined-umbrella/CodeQL/main?label=CodeQL&logo=github)](https://github.com/leonrinkel/reimagined-umbrella/security/code-scanning)
[![](https://img.shields.io/github/workflow/status/leonrinkel/reimagined-umbrella/Docker/main?logo=docker)](https://hub.docker.com/r/leonrinkel/reimagined-umbrella)
[![](https://img.shields.io/node/v/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/blob/main/package.json)

A simple Node.js® project that subscribes to the Coinbase WebSocket API and streams ticker data into InfluxDB.

## Example Usages

```
$ INFLUX_TOKEN=... \
  INFLUX_URL=http://influxdb:8086 \
  PRODUCT_IDS=ETH-USD,YFI-USD \
  npx reimagined-umbrella
```

```
$ docker run \
  --env INFLUX_TOKEN=... \
  --env INFLUX_URL=http://influxdb:8086 \
  --env PRODUCT_IDS=ETH-USD,YFI-USD \
  --restart always \
  --detach \
  leonrinkel/reimagined-umbrella
```

## Example Dashboard

![Crypto Price Ticker Dashboard Screenshot](dashboard.png)
