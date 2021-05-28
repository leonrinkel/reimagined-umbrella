import { InfluxDB, Point } from "@influxdata/influxdb-client";
import process from "process";
import { CoinbaseWebSocket } from "./coinbase-ws";

const DEFAULT_INFLUX_URL = "http://localhost:8086";
const DEFAULT_INFLUX_ORG = "reimagined-umbrella";
const DEFAULT_INFLUX_BUCKET = "reimagined-umbrella";
const DEFAULT_FLUSH_INTERVAL = 10_000;

const MEASUREMENT_NAME = "ticker";
const MEASUREMENT_TAG_PRODUCT_ID = "product_id";
const MEASUREMENT_TAG_SIDE = "side";
const MEASUREMENT_FIELD_PRICE = "price";
const MEASUREMENT_FIELD_OPEN_24H = "open_24h";
const MEASUREMENT_FIELD_VOLUME_24H = "volume_24h";
const MEASUREMENT_FIELD_LOW_24H = "low_24h";
const MEASUREMENT_FIELD_HIGH_24H = "high_24h";
const MEASUREMENT_FIELD_VOLUME_30D = "volume_30d";
const MEASUREMENT_FIELD_BEST_BID = "best_bid";
const MEASUREMENT_FIELD_BEST_ASK = "best_ask";
const MEASUREMENT_FIELD_LAST_SIZE = "last_size";

(async () => {

    const influxUrl = process.env.INFLUX_URL || DEFAULT_INFLUX_URL;
    const influxOrg = process.env.INFLUX_ORG || DEFAULT_INFLUX_ORG;
    const influxBucket = process.env.INFLUX_BUCKET || DEFAULT_INFLUX_BUCKET;
    const influxFlushInterval =
        (process.env.INFLUX_FLUSH_INTERVAL) ?
            Number(process.env.INFLUX_FLUSH_INTERVAL) :
            DEFAULT_FLUSH_INTERVAL;

    const influxToken = process.env.INFLUX_TOKEN;
    if (!influxToken) {
        process.stderr.write(
            "INFLUX_TOKEN environment variable has to be specified");
        process.exit(1);
    }

    const productIds = process.env.PRODUCT_IDS;
    if (!productIds) {
        process.stderr.write(
            "PRODUCT_IDS environment variable has to be specified");
        process.exit(1);
    }

    const influx = new InfluxDB({ url: influxUrl, token: influxToken });
    const writeApi = influx.getWriteApi(
        influxOrg, influxBucket, undefined,
        { flushInterval: influxFlushInterval }
    );

    const coinbase = new CoinbaseWebSocket();
    coinbase.on("ticker", (ticker) => {
        const point = new Point(MEASUREMENT_NAME);
        point
            .timestamp(ticker.time)
            .tag(MEASUREMENT_TAG_PRODUCT_ID, ticker.product_id)
            .tag(MEASUREMENT_TAG_SIDE, ticker.side)
            .floatField(MEASUREMENT_FIELD_PRICE, ticker.price)
            .floatField(MEASUREMENT_FIELD_OPEN_24H, ticker.open_24h)
            .floatField(MEASUREMENT_FIELD_VOLUME_24H, ticker.volume_24h)
            .floatField(MEASUREMENT_FIELD_LOW_24H, ticker.low_24h)
            .floatField(MEASUREMENT_FIELD_HIGH_24H, ticker.high_24h)
            .floatField(MEASUREMENT_FIELD_VOLUME_30D, ticker.volume_30d)
            .floatField(MEASUREMENT_FIELD_BEST_BID, ticker.best_bid)
            .floatField(MEASUREMENT_FIELD_BEST_ASK, ticker.best_ask)
            .floatField(MEASUREMENT_FIELD_LAST_SIZE, ticker.last_size);
        writeApi.writePoint(point);
    });

    await coinbase.open();
    await coinbase.subscribeTicker(...productIds.split(","));

})();
