import EventEmitter from "events";
import util from "util";
import { Logger } from "winston";
import ws from "ws";
import {
    Channel,
    HeartbeatResponse,
    SubscribeRequest,
    SubscriptionsResponse,
    TickerResponse
} from "./coinbase-types";
import { ReconnectingWebSocket } from "./reconnecting-ws";
import { TimeReviver } from "./time-reviver";

const DEFAULT_URL = "wss://ws-feed.pro.coinbase.com";

export declare interface CoinbaseWebSocket {
    on(event: "subscriptions", listener: (e: SubscriptionsResponse) => void): void;
    on(event: "heartbeat", listener: (e: HeartbeatResponse) => void): void;
    on(event: "ticker", listener: (e: TickerResponse) => void): void;
}

export type CoinbaseWebSocketOptions = {
    url?: string;
    delay?: number;
    maxAttempts?: number;
    logger?: Logger;
};

/**
 * WebSocket wrapper with convenience functions for subscribing Coinbase API
 * channels
 */
export class CoinbaseWebSocket extends ReconnectingWebSocket {

    private _logger?: Logger;
    private _events = new EventEmitter();
    private _channels: Channel[] = [];

    constructor(options?: CoinbaseWebSocketOptions) {
        super({
            ...options,
            url: options?.url || DEFAULT_URL
        });

        this._logger = options?.logger;
        if (this._logger) {
            for (const event of [ "subscriptions", "heartbeat", "ticker" ]) {
                this._events.on(event, (e) =>
                    this._logger?.debug(
                        `received ${event} response\n` +
                        util.inspect(e, { compact: true })
                    )
                );
            }
        }
    }

    /**
     * Sends a subscribe request
     * @param request the request
     * @returns a promise that will be resolved when the subscription has been
     *          acknowledged or rejected otherwise
     */
    public subscribe(request: SubscribeRequest): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._ws?.send(JSON.stringify(request));
            this._logger?.debug(
                "sent subscribe request\n" +
                util.inspect(request, { compact: true })
            );

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

                if (subscriptionSuccessful) {
                    this._channels.push(...request.channels);
                    resolve();
                }
                else reject(new Error("subscription failed"));
            };
            this._events.on("subscriptions", listener);
        });
    }

    /**
     * Convenience function to subscribe to the heartbeat channel
     * @param productIds a list of product ids
     * @returns a promise that will be resolved when the subscription has been
     *          acknowledged or rejected otherwise
     */
    public subscribeHeartbeat(...productIds: string[]): Promise<void> {
        return this.subscribe({
            type: "subscribe",
            channels: [ { name: "heartbeat", product_ids: productIds } ]
        });
    }

    /**
     * Convenience function to subscribe to the ticker channel
     * @param productIds a list of product ids
     * @returns a promise that will be resolved when the subscription has been
     *          acknowledged or rejected otherwise
     */
    public subscribeTicker(...productIds: string[]): Promise<void> {
        return this.subscribe({
            type: "subscribe",
            channels: [ { name: "ticker", product_ids: productIds } ]
        });
    }

    /**
     * Registers an event listener.
     * @param event the event name
     * @param listener the listener callback to register
     */
    public on(event: string, listener: (...args: any[]) => void) {
        this._events.on(event, listener);
    }

    protected _onMessage(data: ws.Data) {
        const message = JSON.parse(data.toString("utf-8"), TimeReviver);
        if (
            message.type === "subscriptions" ||
            message.type === "heartbeat" ||
            message.type === "ticker"
        ) this._events.emit(message.type, message);
    }

    protected _onReconnected(): void {
        this._logger?.info("reconnected, trying to resubscribe...");
        this
            .subscribe({
                type: "subscribe",
                channels: this._channels
            })
            .then(() => this._logger?.info("successfully resubscribed"))
            .catch(() => {
                this._logger?.error("resubscription failed, closing socket...");
                this.close();
            });
    }

}
