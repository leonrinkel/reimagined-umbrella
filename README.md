# reimagined-umbrella

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
