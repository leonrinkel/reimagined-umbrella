import { InfluxDB, Point } from "@influxdata/influxdb-client";
import process from "process";
import util from "util";
import winston from "winston";
import { CoinbaseWebSocket } from "./coinbase-ws";

// default values for env variable options
const DEFAULT_INFLUX_URL = "http://localhost:8086";
const DEFAULT_INFLUX_ORG = "reimagined-umbrella";
const DEFAULT_INFLUX_BUCKET = "reimagined-umbrella";
const DEFAULT_INFLUX_FLUSH_INTERVAL = 10_000 /* ms */; // bundle writes and flush after some time

const DEFAULT_COINBASE_URL = "wss://ws-feed.pro.coinbase.com";
const DEFAULT_COINBASE_RECONNECT_DELAY = 1_000 /* ms */;
const DEFAULT_COINBASE_MAX_RECONNECT_TRIES = 60;
const DEFAULT_COINBASE_TIMEOUT_INTERVAL = 10_000 /* ms */;

// influx measurement name, tag name, field names to use
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

    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.colorize(),
            winston.format.printf(info =>
                `${info.timestamp} ${info.level}: ${info.message}`),
        ),
        transports: [ new winston.transports.Console() ]
    });

    // read influx env variable options

    const influxUrl = process.env.INFLUX_URL || DEFAULT_INFLUX_URL;
    const influxOrg = process.env.INFLUX_ORG || DEFAULT_INFLUX_ORG;
    const influxBucket = process.env.INFLUX_BUCKET || DEFAULT_INFLUX_BUCKET;
    const influxFlushInterval =
        (process.env.INFLUX_FLUSH_INTERVAL) ?
            Number(process.env.INFLUX_FLUSH_INTERVAL) :
            DEFAULT_INFLUX_FLUSH_INTERVAL;

    const influxToken = process.env.INFLUX_TOKEN;
    if (!influxToken) {
        logger.error("INFLUX_TOKEN environment variable has to be specified");
        process.exit(1);
    }

    // read coinbase env variable options

    const url = process.env.COINBASE_URL || DEFAULT_COINBASE_URL;
    const reconnectDelay =
        (process.env.COINBASE_RECONNECT_DELAY) ?
            Number(process.env.COINBASE_RECONNECT_DELAY) :
            DEFAULT_COINBASE_RECONNECT_DELAY;
    const maxReconnectTries =
        (process.env.COINBASE_MAX_RECONNECT_TRIES) ?
            Number(process.env.COINBASE_MAX_RECONNECT_TRIES) :
            DEFAULT_COINBASE_MAX_RECONNECT_TRIES;
    const timeoutInterval =
        (process.env.COINBASE_TIMEOUT_INTERVAL) ?
            Number(process.env.COINBASE_TIMEOUT_INTERVAL) :
            DEFAULT_COINBASE_TIMEOUT_INTERVAL;

    const productIds = process.env.PRODUCT_IDS; // comma separated list
    if (!productIds) {
        logger.error("PRODUCT_IDS environment variable has to be specified");
        process.exit(1);
    }

    // open a new influx write api

    logger.info(
        "opening influx write api\n" +
        util.inspect(
            { influxUrl, influxOrg, influxBucket, influxFlushInterval },
            { compact: true, colors: true }
        )
    );

    const influx = new InfluxDB({ url: influxUrl, token: influxToken });
    const writeApi = influx.getWriteApi(
        influxOrg, influxBucket, undefined,
        { flushInterval: influxFlushInterval }
    );

    // create a new coinbase socket and register event listeners

    const coinbase = new CoinbaseWebSocket({
        logger, url, reconnectDelay, maxReconnectTries, timeoutInterval });

    coinbase.on("heartbeat", (heartbeat) =>
        logger.debug(
            "received heartbeat\n" +
            util.inspect(heartbeat, { compact: true, colors: true })
        )
    );

    coinbase.on("ticker", (ticker) => {
        logger.debug(
            "received ticker\n" +
            util.inspect(ticker, { compact: true, colors: true })
        );

        // create point and queue to write
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

    coinbase.on("failure", () => {
        logger.error("coinbase connection ultimately failed, exiting...");
        process.exit(1);
    });

    // open connection and subscribe to channels

    await coinbase
        .connect()
        .then(() => logger.info("successfully connected to coinbase"))
        .catch(() => {
            logger.error("unable to connect to coinbase, exiting...");
            process.exit(1);
        });

    await coinbase
        .subscribe(...productIds.split(","))
        .then(() => logger.info("successfully subscribed to api channels"))
        .catch(() => {
            logger.error("unable to subscribe to api channels, exiting...");
            process.exit(1);
        });

})();
