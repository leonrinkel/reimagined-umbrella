import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import ws from "ws";
import { ReconnectingWebSocket } from "../src/reconnecting-ws";

chai.use(chaiAsPromised);
chai.should();

class TestableReconnectingWebSocket extends ReconnectingWebSocket {
    public _onMessage(data: ws.Data): void {}
    public _onReconnected(): void {}
}

describe("ReconnectingWebSocket", () => {

    const port = 4269;
    const url = `ws://localhost:${port}`;
    let trws: ReconnectingWebSocket;
    let wss: ws.Server;

    beforeEach(() => {
        wss = new ws.Server({ port });
    });

    afterEach(() => {
        if (trws) trws.close();
        if (wss) wss.close();
    });

    describe("#open()", () => {

        it("should resolve if connection succeeds", () => {
            trws = new TestableReconnectingWebSocket({ url });
            return trws.open().should.be.fulfilled;
        });

        it("should reject if connection fails", () => {
            trws = new TestableReconnectingWebSocket({ url: "ws://localhost:12345"});
            return trws.open().should.be.rejected;
        });

    });

    it("should automatically reconnect a closed connection", (done) => {
        trws = new TestableReconnectingWebSocket({ url, delay: 1 });

        let connection: ws;
        wss.once("connection", (_connection) => connection = _connection);

        trws
            .open()
            .then(() => {
                wss.once("connection", () => setTimeout(() => done()));
                setTimeout(() => connection.close());
            });
    });

    describe("#_onMessage()", () => {

        it("should be called on new messages", (done) => {
            sinon.replace(
                TestableReconnectingWebSocket.prototype,
                "_onMessage",
                () => done()
            );

            wss.once("connection", (connection) => connection.send("hi"));

            trws = new TestableReconnectingWebSocket({ url });
            trws.open();
        });

    });

    describe("#_onReconnected()", () => {

        it("should be called upon successful reconnection", (done) => {
            sinon.replace(
                TestableReconnectingWebSocket.prototype,
                "_onReconnected",
                () => done()
            );

            trws = new TestableReconnectingWebSocket({ url, delay: 1 });

            let connection: ws;
            wss.once("connection", (_connection) => connection = _connection);

            trws
                .open()
                .then(() => setTimeout(() => connection.close()));
        });

    });

});
