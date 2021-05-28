import EventEmitter from "events";
import ws from "ws";
import {
    HeartbeatResponse,
    SubscribeRequest,
    SubscriptionsResponse,
    TickerResponse
} from "./coinbase-types";

const DEFAULT_URL = "wss://ws-feed.pro.coinbase.com";

const timeReviver =
    (key: string, value: string) => {
        if (
            key === "time" &&
            typeof value === "string"
        ) return new Date(value);
        return value;
    };

export declare interface CoinbaseWebSocket {
    on(event: "subscriptions", listener: (e: SubscriptionsResponse) => void): void;
    on(event: "heartbeat", listener: (e: HeartbeatResponse) => void): void;
    on(event: "ticker", listener: (e: TickerResponse) => void): void;
}

export class CoinbaseWebSocket {

    private _url: string;
    private _ws?: ws;
    private _events = new EventEmitter();

    constructor(options?: { url?: string }) {
        this._url = options?.url || DEFAULT_URL;
    }

    public open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._ws = new ws(this._url);
            this._ws.on("message", (data) => this._onMessage(data));
            this._ws.on("open", () => resolve());
            this._ws.on("error", () => reject());
        });
    }

    public subscribe(request: SubscribeRequest): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._ws?.send(JSON.stringify(request));

            const listener = (e: SubscriptionsResponse) => {
                this._events.removeListener("subscriptions", listener);

                const subscriptionSuccessful =
                    request.channels.every(requested_channel => {
                        const channel = e.channels.find(possible_channel =>
                            possible_channel.name == requested_channel.name);
                        if (!channel) return false;

                        return requested_channel.product_ids.every(requested_product_id =>
                            channel.product_ids.includes(requested_product_id));
                    });

                if (subscriptionSuccessful) resolve();
                else reject(new Error("subscription failed"));
            };
            this._events.on("subscriptions", listener);
        });
    }

    public on(event: string, listener: (...args: any[]) => void) {
        this._events.on(event, listener);
    }

    private _onMessage(data: ws.Data) {
        const message = JSON.parse(data.toString("utf-8"), timeReviver);
        if (
            message.type === "subscriptions" ||
            message.type === "heartbeat" ||
            message.type === "ticker"
        ) this._events.emit(message.type, message);
    }

}
