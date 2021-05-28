import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import ws from "ws";
import { SubscribeRequest, SubscriptionsResponse } from "../src/coinbase-types";
import { CoinbaseWebSocket } from "../src/coinbase-ws";

chai.use(chaiAsPromised);
chai.should();

describe("CoinbaseWebSocket", () => {

    const port = 4269;
    const url = `ws://localhost:${port}`;
    let wss: ws.Server;

    beforeEach(() => {
        wss = new ws.Server({ port });
    });

    afterEach(() => {
        wss.close();
    });

    describe("#open()", () => {

        it("should resolve if connection succeeds", () => {
            const cws = new CoinbaseWebSocket({ url });
            return cws.open().should.be.fulfilled;
        });

        it("should reject if connection fails", () => {
            const cws = new CoinbaseWebSocket({ url: "ws://localhost:12345"});
            return cws.open().should.be.rejected;
        });

    });

    describe("#subscribe()", () => {

        it("should send the request message", (done) => {
            const request: SubscribeRequest = {
                type: "subscribe",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD" ] },
                    { name: "ticker", product_ids: [ "ETH-USD" ] }
                ]
            };

            wss.once("connection", (socket) =>
                socket.once("message", (data) => {
                    expect(data.toString("utf-8"))
                        .to.equal(JSON.stringify(request));
                    done();
                }));

            const cws = new CoinbaseWebSocket({ url });
            cws.open().then(() => cws.subscribe(request));
        });

        it("should resolve if subscription succeeds", () => {
            const request: SubscribeRequest = {
                type: "subscribe",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD" ] },
                    { name: "ticker", product_ids: [ "ETH-USD" ] }
                ]
            };

            const response: SubscriptionsResponse = {
                type: "subscriptions",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD" ] },
                    { name: "ticker", product_ids: [ "ETH-USD" ] }
                ]
            };

            wss.once("connection", (socket) =>
                socket.once("message", () => {
                    socket.send(JSON.stringify(response));
                }));

            const cws = new CoinbaseWebSocket({ url });
            return cws.open().then(() => cws.subscribe(request)).should.be.fulfilled;
        });

        it("should reject if subscriptions miss a channel", () => {
            const request: SubscribeRequest = {
                type: "subscribe",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD" ] },
                    { name: "ticker", product_ids: [ "ETH-USD" ] }
                ]
            };

            const response: SubscriptionsResponse = {
                type: "subscriptions",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD" ] }
                ]
            };

            wss.once("connection", (socket) =>
                socket.once("message", () => {
                    socket.send(JSON.stringify(response));
                }));

            const cws = new CoinbaseWebSocket({ url });
            return cws.open().then(() => cws.subscribe(request)).should.be.rejected;
        });

        it("should reject if subscriptions miss a product id", () => {
            const request: SubscribeRequest = {
                type: "subscribe",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD" ] },
                    { name: "ticker", product_ids: [ "ETH-USD" ] }
                ]
            };

            const response: SubscriptionsResponse = {
                type: "subscriptions",
                channels: [
                    { name: "heartbeat", product_ids: [] },
                    { name: "ticker", product_ids: [ "ETH-USD" ] }
                ]
            };

            wss.once("connection", (socket) =>
                socket.once("message", () => {
                    socket.send(JSON.stringify(response));
                }));

            const cws = new CoinbaseWebSocket({ url });
            return cws.open().then(() => cws.subscribe(request)).should.be.rejected;
        });

    });

    describe("#on()", () => {

        it("should callback on subscriptions messages", async () => {
            const message: SubscriptionsResponse = {
                type: "subscriptions",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD" ] },
                    { name: "ticker", product_ids: [ "ETH-USD" ] }
                ]
            };

            wss.once("connection", (socket) =>
                socket.send(JSON.stringify(message)));

            const cws = new CoinbaseWebSocket({ url });
            return new Promise<void>((resolve, reject) => {
                cws.on("subscriptions", (e) => {
                    if (JSON.stringify(e) === JSON.stringify(message))
                        resolve();
                    else reject();
                });
                cws.open();
            });
        });

        it("should callback on heartbeat messages", () => {
            const message = {
                type: "heartbeat",
                sequence: 12345,
                last_trade_id: 0,
                product_id: "ETH-USD",
                time: "2021-05-28T13:38:19.460Z"
            };

            wss.once("connection", (socket) =>
                socket.send(JSON.stringify(message)));

            const cws = new CoinbaseWebSocket({ url });
            return new Promise<void>((resolve, reject) => {
                cws.on("heartbeat", (e) => {
                    if (JSON.stringify(e) === JSON.stringify(message))
                        resolve();
                    else reject();
                });
                cws.open();
            });
        });

        it("should callback on ticker messages", () => {
            const message = {
                type: "ticker",
                sequence: 12345,
                product_id: "ETH-USD",
                price: "123.45",
                open_24h: "123.45",
                volume_24h: "123.45",
                low_24h: "123.45",
                high_24h: "123.45",
                volume_30d: "123.45",
                best_bid: "123.45",
                best_ask: "123.45",
                side: "buy",
                time: "2021-05-28T13:38:19.460Z",
                trade_id: 0,
                last_size: "123.45"
            };

            wss.once("connection", (socket) =>
                socket.send(JSON.stringify(message)));

            const cws = new CoinbaseWebSocket({ url });
            return new Promise<void>((resolve, reject) => {
                cws.on("ticker", (e) => {
                    if (JSON.stringify(e) === JSON.stringify(message))
                        resolve();
                    else reject();
                });
                cws.open();
            });
        });

    });

});
