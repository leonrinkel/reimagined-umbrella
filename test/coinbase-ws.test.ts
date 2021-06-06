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
    let cws: CoinbaseWebSocket;
    let wss: ws.Server;

    beforeEach(() => {
        wss = new ws.Server({ port });
    });

    afterEach(() => {
        if (cws) cws.close();
        if (wss) wss.close();
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

            cws = new CoinbaseWebSocket({ url });
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

            cws = new CoinbaseWebSocket({ url });
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

            cws = new CoinbaseWebSocket({ url });
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

            cws = new CoinbaseWebSocket({ url });
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

            cws = new CoinbaseWebSocket({ url });
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

            cws = new CoinbaseWebSocket({ url });
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

            cws = new CoinbaseWebSocket({ url });
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

    describe("#subscribeHeartbeat()", () => {

        it("should send the request message", (done) => {
            const request: SubscribeRequest = {
                type: "subscribe",
                channels: [
                    { name: "heartbeat", product_ids: [ "ETH-USD", "ETH-EUR" ] }
                ]
            };

            wss.once("connection", (socket) =>
                socket.once("message", (data) => {
                    expect(data.toString("utf-8"))
                        .to.equal(JSON.stringify(request));
                    done();
                }));

            cws = new CoinbaseWebSocket({ url });
            cws.open().then(() => cws.subscribeHeartbeat("ETH-USD", "ETH-EUR"));
        });

    });

    describe("#subscribeTicker()", () => {

        it("should send the request message", (done) => {
            const request: SubscribeRequest = {
                type: "subscribe",
                channels: [
                    { name: "ticker", product_ids: [ "ETH-USD", "ETH-EUR" ] }
                ]
            };

            wss.once("connection", (socket) =>
                socket.once("message", (data) => {
                    expect(data.toString("utf-8"))
                        .to.equal(JSON.stringify(request));
                    done();
                }));

            cws = new CoinbaseWebSocket({ url });
            cws.open().then(() => cws.subscribeTicker("ETH-USD", "ETH-EUR"));
        });

    });

    describe("#_onReconnected()", () => {

        it("should send a subscribe request for previously connected channels", (done) => {
            cws = new CoinbaseWebSocket({ url, delay: 1 });

            let connection: ws;
            let subscribeRequest: any;
            wss.once("connection", (_connection) => {
                connection = _connection;
                connection.once("message", (data) => {
                    subscribeRequest = JSON.parse(data.toString("utf-8"));
                    connection.send(
                        JSON.stringify({ ...subscribeRequest, type: "subscriptions" }));
                });
            });

            cws
                .open()
                .then(() => cws.subscribeHeartbeat("ETH-USD"))
                .then(() => {
                    wss.once("connection", (connection) => {
                        connection.once("message", (data) => {
                            const resubscribeRequest = JSON.parse(data.toString("utf-8"));
                            expect(resubscribeRequest).to.deep.equal(subscribeRequest);
                            done();
                        });
                    });

                    setTimeout(() => connection.close());
                });
        });

        it("should close connection when resubscribe fails", (done) => {
            cws = new CoinbaseWebSocket({ url, delay: 1 });

            let connection: ws;
            wss.once("connection", (_connection) => {
                connection = _connection;
                connection.once("message", (data) => {
                    const subscribeRequest = JSON.parse(data.toString("utf-8"));
                    connection.send(
                        JSON.stringify({ ...subscribeRequest, type: "subscriptions" }));
                });
            });

            cws
                .open()
                .then(() => cws.subscribeHeartbeat("ETH-USD"))
                .then(() => {
                    wss.once("connection", (connection) => {
                        connection.once("message", () => {
                            connection.send(
                                JSON.stringify({ type: "subscriptions", channels: [] }));
                        });
                        connection.once("close", () => done());
                    });

                    setTimeout(() => connection.close());
                });
        });

    });

});
