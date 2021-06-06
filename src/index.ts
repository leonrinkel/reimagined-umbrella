import { InfluxDB, Point } from "@influxdata/influxdb-client";
import process from "process";
import util from "util";
import winston from "winston";
import { CoinbaseWebSocket } from "./coinbase-ws";

// default values for env variable options
const DEFAULT_INFLUX_URL = "http://localhost:8086";
const DEFAULT_INFLUX_ORG = "reimagined-umbrella";
const DEFAULT_INFLUX_BUCKET = "reimagined-umbrella";
const DEFAULT_FLUSH_INTERVAL = 10_000 /* ms */; // bundle writes and flush after some time

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

// the program will timeout if no heartbeat events have been received
const TIMEOUT_INTERVAL = 10_000 /* ms */;

(async () => {

    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || "info",
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
        transports: [ new winston.transports.Console() ]
    });

    // read env variable options

    const influxUrl = process.env.INFLUX_URL || DEFAULT_INFLUX_URL;
    const influxOrg = process.env.INFLUX_ORG || DEFAULT_INFLUX_ORG;
    const influxBucket = process.env.INFLUX_BUCKET || DEFAULT_INFLUX_BUCKET;
    const influxFlushInterval =
        (process.env.INFLUX_FLUSH_INTERVAL) ?
            Number(process.env.INFLUX_FLUSH_INTERVAL) :
            DEFAULT_FLUSH_INTERVAL;

    const influxToken = process.env.INFLUX_TOKEN;
    if (!influxToken) {
        logger.error("INFLUX_TOKEN environment variable has to be specified");
        process.exit(1);
    }

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
            { compact: true }
        )
    );

    const influx = new InfluxDB({ url: influxUrl, token: influxToken });
    const writeApi = influx.getWriteApi(
        influxOrg, influxBucket, undefined,
        { flushInterval: influxFlushInterval }
    );

    // create a new coinbase socket and register event listeners

    const coinbase = new CoinbaseWebSocket({ logger });

    let lastHeartbeat = new Date();
    coinbase.on("heartbeat", (heartbeat) => {
        lastHeartbeat = heartbeat.time;
    });

    coinbase.on("ticker", (ticker) => {
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

    // open connection and subscribe to channels

    await coinbase
        .open()
        .then(() => logger.info("successfully connected to coinbase"))
        .catch(() => {
            logger.error("unable to connect to coinbase, exiting...");
            process.exit(1);
        });

    await coinbase
        .subscribeHeartbeat(...productIds.split(","))
        .then(() => logger.info("successfully subscribed to heartbeat channels"))
        .catch(() => {
            logger.info("unable to subscribe to heartbeat channels, exiting...");
            process.exit(1);
        });

    await coinbase
        .subscribeTicker(...productIds.split(","))
        .then(() => logger.info("successfully subscribed to ticker channels"))
        .catch(() => {
            logger.info("unable to subscribe to ticker channels, exiting...");
            process.exit(1);
        });

    // monitor heartbeats
    setInterval(() => {
        if (lastHeartbeat.getTime() < Date.now() - TIMEOUT_INTERVAL) {
            logger.warn("received no heartbeats for more than " +
                `${TIMEOUT_INTERVAL} ms, trying to reconnect...`);

            coinbase
                .reconnect()
                .then(() => logger.info("successfully reconnected"))
                .catch(() => {
                    logger.error("unable to reconnect, exiting...");
                    process.exit(1);
                });
        }
    }, TIMEOUT_INTERVAL);

})();
