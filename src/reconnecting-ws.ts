import ws from "ws";

const DEFAULT_DELAY = 1_000 /* ms */;
const DEFAULT_MAX_ATTEMPTS = 60;

export type ReconnectingWebSocketOptions = {
    url: string;
    delay?: number;
    maxAttempts?: number;
};

/**
 * WebSocket wrapper that automatically tries reconnecting a disconnected socket
 */
export abstract class ReconnectingWebSocket {

    private _url: string;
    private _delay: number;
    private _maxAttempts: number;
    protected _ws?: ws;

    constructor(options: ReconnectingWebSocketOptions) {
        this._url = options.url;
        this._delay = options.delay || DEFAULT_DELAY;
        this._maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    }

    /**
     * Opens a WebSocket connection
     * @returns a promise that will be resolved when the connection succeeded
     */
     public open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._ws = new ws(this._url);
            this._ws.on("message", (data) => this._onMessage(data));
            this._ws.on("open", () => {
                this._ws!.once("close", () => this.reconnect());
                resolve();
            });
            this._ws.on("error", () => reject());
        });
    }

    /**
     * Unregisters reconnect listeners and closes the WebSocket
     */
    public close() {
        this._ws?.removeAllListeners("close");
        this._ws?.close();
    }

    public reconnect(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._reconnect(0, resolve, reject);
        });
    }

    /**
     * Will be called on new received messages
     * @param data the message
     */
    protected abstract _onMessage(data: ws.Data): void;

     /**
      * Will be called after a successful reconnection attempt
      */
    protected abstract _onReconnected(): void;

    private _reconnect(
        attempt: number,
        resolve: () => void,
        reject: () => void
    ): void {
        if (attempt > this._maxAttempts) return reject();
        setTimeout(() => {
            this
                .open()
                .then(() => {
                    setTimeout(() => this._onReconnected());
                    resolve();
                })
                .catch(() => this._reconnect(attempt + 1, resolve, reject));
        }, this._delay);
    }

}
