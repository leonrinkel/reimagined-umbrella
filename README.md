# reimagined-umbrella

[![](https://img.shields.io/npm/v/reimagined-umbrella)](https://www.npmjs.com/package/reimagined-umbrella)
[![](https://img.shields.io/librariesio/release/npm/reimagined-umbrella)](https://www.npmjs.com/package/reimagined-umbrella)
[![](https://img.shields.io/github/issues/leonrinkel/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/issues)
[![](https://img.shields.io/github/license/leonrinkel/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/blob/main/LICENSE)
[![](https://img.shields.io/github/contributors/leonrinkel/reimagined-umbrella)](https://github.com/leonrinkel/reimagined-umbrella/graphs/contributors)
[![](https://img.shields.io/github/workflow/status/leonrinkel/reimagined-umbrella/Node.js%20CI/main)](https://github.com/leonrinkel/reimagined-umbrella/actions/workflows/node.js.yml)
[![](https://img.shields.io/github/workflow/status/leonrinkel/reimagined-umbrella/CodeQL/main?label=CodeQL)](https://github.com/leonrinkel/reimagined-umbrella/security/code-scanning)

A simple Node.js® project that subscribes to the Coinbase WebSocket API and streams ticker data into InfluxDB.

## Example Usage

```
docker build -t reimagined-umbrella .
docker run \
    --name reimagined-umbrella \
    --env INFLUX_TOKEN=... \
    --env INFLUX_URL=http://influxdb:8086 \
    --env PRODUCT_IDS=ETH-USD,YFI-USD \
    --restart always \
    --detach \
    reimagined-umbrella
```

Note: `--restart always` is required since Coinbase disconnects after some time. The program will then just exit and expect Docker to restart it. I might change the WebSocket to automatically reconnect, but for now this works as well.

## Example Dashboard

![Crypto Price Ticker Dashboard Screenshot](dashboard.png)
