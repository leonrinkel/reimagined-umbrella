import { EventEmitter } from "events";
import util from "util";
import winston from "winston";
import ws from "ws";
import {
    HeartbeatResponse,
    SubscribeRequest,
    SubscriptionsResponse,
    TickerResponse
} from "./coinbase-types";
import { TimeReviver } from "./time-reviver";

type ReconnectingWebSocketOperationNames =
    "connect" |
    "reconnect" |
    "subscribe";
type ReconnectingWebSocketOperations =
    Record<ReconnectingWebSocketOperationNames, (...args: any) => void>;

type ReconnectingWebSocketEventNames =
    "onWebSocketOpen" |
    "onWebSocketError" |
    "onWebSocketClose" |
    "onSubscribed" |
    "onSubscriptionFailed" |
    "onHeartbeatTimeout";
type ReconnectingWebSocketEvents =
    Record<ReconnectingWebSocketEventNames, (...args: any) => void>;

type ReconnectingWebSocketOptions = {
    logger?: winston.Logger;
    url: string;
    reconnectDelay: number;
    maxReconnectTries: number;
};

type ReconnectingWebSocketContext = {
    webSocket?: ws;
    reconnectTries?: number;
    productIds?: string[];
};

type ReconnectingWebSocketStateName =
    "Idle" |
    "Connecting" |
    "Connected" |
    "Failed" |
    "Disconnected" |
    "Reconnecting" |
    "Reconnected" |
    "WaitingToReconnect" |
    "Subscribing" |
    "Subscribed" |
    "Timeouted";

abstract class ReconnectingWebSocketState
    implements ReconnectingWebSocketOperations, ReconnectingWebSocketEvents {

    protected instance: ReconnectingWebSocketInternals;

    constructor(instance: ReconnectingWebSocketInternals) {
        this.instance = instance;
    }

    public abstract get name(): ReconnectingWebSocketStateName;

    public abstract handle(): void;

    public connect(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public reconnect(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public subscribe(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketOpen(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketError(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketClose(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onSubscribed(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onSubscriptionFailed(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onHeartbeatTimeout(...args: any): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

}

class ReconnectingWebSocketIdleState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Idle";
    }

    public handle(): void {}

    public override connect() {
        return new ReconnectingWebSocketConnectingState(this.instance);
    }

}

class ReconnectingWebSocketConnectingState
    extends ReconnectingWebSocketState {

    private onOpenListener?: () => void;
    private onErrorListener?: () => void;

    public get name(): ReconnectingWebSocketStateName {
        return "Connecting";
    }

    public handle(): void {
        this.instance.context.webSocket = new ws(this.instance.options.url);

        this.onOpenListener =
            () => this.instance.transition("onWebSocketOpen");
        this.onErrorListener =
            () => this.instance.transition("onWebSocketError");

        this.instance.context.webSocket.on("open", this.onOpenListener);
        this.instance.context.webSocket.on("error", this.onErrorListener);

        // TODO: remove
        this.instance.options.logger?.debug(
            util.inspect({
                listenerCounts: {
                    open: this.instance.context.webSocket.listenerCount("open"),
                    error: this.instance.context.webSocket.listenerCount("error"),
                },
            }, { compact: true, colors: true })
        );
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("open", this.onOpenListener!);
        this.instance.context.webSocket!
            .removeListener("error", this.onErrorListener!);
    }

    public override onWebSocketOpen() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketConnectedState(this.instance);
    }

    public override onWebSocketError() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketIdleState(this.instance);
    }

}

class ReconnectingWebSocketConnectedState
    extends ReconnectingWebSocketState {

    private onCloseListener?: () => void;

    public get name(): ReconnectingWebSocketStateName {
        return "Connected";
    }

    public handle(): void {
        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.instance.context.webSocket!.on("close", this.onCloseListener);

        // TODO: remove
        this.instance.options.logger?.debug(
            util.inspect({
                listenerCounts: {
                    close: this.instance.context.webSocket!.listenerCount("close"),
                }
            }, { compact: true, colors: true })
        );
    }

    private cleanUpListeners() {
        this.instance.context.webSocket
            ?.removeListener("close", this.onCloseListener!);
    }

    public override onWebSocketClose() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

    public override subscribe(productIds: string[]) {
        this.cleanUpListeners();
        return new ReconnectingWebSocketSubscribingState(this.instance, productIds);
    }

}

class ReconnectingWebSocketFailedState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Failed";
    }

    public handle(): void {}

}

class ReconnectingWebSocketDisconnectedState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Disconnected";
    }

    public handle(): void {
        setTimeout(() => this.instance.transition("reconnect"));
    }

    public override reconnect() {
        this.instance.context.reconnectTries = 0;
        return new ReconnectingWebSocketReconnectingState(this.instance);
    }

}

class ReconnectingWebSocketReconnectingState
    extends ReconnectingWebSocketState {

    private onOpenListener?: () => void;
    private onErrorListener?: () => void;

    public get name(): ReconnectingWebSocketStateName {
        return "Reconnecting";
    }

    public handle(): void {
        this.instance.context.webSocket = new ws(this.instance.options.url);

        this.onOpenListener =
            () => this.instance.transition("onWebSocketOpen");
        this.onErrorListener =
            () => this.instance.transition("onWebSocketError");

        this.instance.context.webSocket.on("open", this.onOpenListener);
        this.instance.context.webSocket.on("error", this.onErrorListener);

        // TODO: remove
        this.instance.options.logger?.debug(
            util.inspect({
                listenerCounts: {
                    open: this.instance.context.webSocket!.listenerCount("open"),
                    error: this.instance.context.webSocket!.listenerCount("error"),
                },
            }, { compact: true, colors: true })
        );
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("open", this.onOpenListener!);
        this.instance.context.webSocket!
            .removeListener("error", this.onErrorListener!);
    }

    public override onWebSocketOpen() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketReconnectedState(this.instance);
    }

    public override onWebSocketError() {
        this.cleanUpListeners();

        if (
            this.instance.context.reconnectTries! <
            this.instance.options.maxReconnectTries
        ) return new ReconnectingWebSocketWaitingToReconnectState(this.instance);
        else return new ReconnectingWebSocketFailedState(this.instance);
    }

}

class ReconnectingWebSocketReconnectedState
    extends ReconnectingWebSocketState {

    private onCloseListener?: () => void;

    public get name(): ReconnectingWebSocketStateName {
        return "Reconnected";
    }

    public handle(): void {
        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.instance.context.webSocket!.on("close", this.onCloseListener);

        setTimeout(() => this.instance.transition(
            "subscribe", this.instance.context.productIds));

        // TODO: remove
        this.instance.options.logger?.debug(
            util.inspect({
                listenerCounts: {
                    close: this.instance.context.webSocket!.listenerCount("close"),
                },
            }, { compact: true, colors: true })
        );
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
    }

    public override onWebSocketClose() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

    public override subscribe(productIds: string[]) {
        this.cleanUpListeners();
        return new ReconnectingWebSocketSubscribingState(this.instance, productIds);
    }

}

class ReconnectingWebSocketWaitingToReconnectState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "WaitingToReconnect";
    }

    public handle(): void {
        setTimeout(
            () => this.instance.transition("reconnect"),
            this.instance.options.reconnectDelay
        );
    }

    public override reconnect() {
        this.instance.context.reconnectTries! += 1;
        return new ReconnectingWebSocketReconnectingState(this.instance);
    }

}

class ReconnectingWebSocketSubscribingState
    extends ReconnectingWebSocketState {

    private onCloseListener?: () => void;
    private onMessageListener?: (data: ws.Data) => void;

    constructor(
        instance: ReconnectingWebSocketInternals,
        productIds: string[]
    ) {
        super(instance);
        this.instance.context.productIds = productIds;
    }

    public get name(): ReconnectingWebSocketStateName {
        return "Subscribing";
    }

    public handle(): void {
        const request: SubscribeRequest = {
            type: "subscribe",
            channels: [
                {
                    name: "heartbeat",
                    product_ids: this.instance.context.productIds!,
                },
                {
                    name: "ticker",
                    product_ids: this.instance.context.productIds!,
                },
            ],
        };

        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.onMessageListener = (data: ws.Data): void => {
            const message = JSON.parse(data.toString("utf-8"));
            if (message.type !== "subscriptions") return;
            const response = message as SubscriptionsResponse;

            const subscriptionSuccessful =
                request.channels.every(requestedChannel => {
                    const channel =
                        response.channels.find(possibleChannel =>
                            possibleChannel.name == requestedChannel.name);
                    if (!channel) return false;

                    return requestedChannel.product_ids.
                        every(requestedProductId =>
                            channel.product_ids.includes(requestedProductId));
                });

            if (subscriptionSuccessful)
                this.instance.transition("onSubscribed", response);
            else this.instance.transition("onSubscriptionFailed");
        };

        this.instance.context.webSocket!.on("close", this.onCloseListener);
        this.instance.context.webSocket!.on("message", this.onMessageListener);

        // TODO: remove
        this.instance.options.logger?.debug(
            util.inspect({
                listenerCounts: {
                    close: this.instance.context.webSocket!.listenerCount("close"),
                    message: this.instance.context.webSocket!.listenerCount("message"),
                },
            }, { compact: true, colors: true })
        );

        this.instance.context.webSocket!
            .send(JSON.stringify(request));
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
        this.instance.context.webSocket!
            .removeListener("message", this.onMessageListener!);
    }

    public override onWebSocketClose() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

    public override onSubscribed(response: SubscriptionsResponse) {
        this.cleanUpListeners();
        return new ReconnectingWebSocketSubscribedState(this.instance);
    }

    public override onSubscriptionFailed() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketFailedState(this.instance);
    }

}

class ReconnectingWebSocketSubscribedState
    extends ReconnectingWebSocketState {

    private onCloseListener?: () => void;
    private onMessageListener?: (data: ws.Data) => void;

    private lastHeartbeat?: Date;
    private heartbeatCheckInterval?: NodeJS.Timeout;

    public get name(): ReconnectingWebSocketStateName {
        return "Subscribed";
    }

    public handle(): void {
        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.onMessageListener =
            (data: ws.Data) => {
                const message = JSON.parse(data.toString("utf-8"), TimeReviver);
                if (message.type === "heartbeat") {
                    this.instance.events.emit("heartbeat", message);
                    this.lastHeartbeat = (message as HeartbeatResponse).time;
                } else if (message.type === "ticker") {
                    this.instance.events.emit("ticker", message);
                }
            };

        this.instance.context.webSocket!.on("close", this.onCloseListener);
        this.instance.context.webSocket!.on("message", this.onMessageListener);

        setInterval(
            () => {
                if (
                    this.lastHeartbeat &&
                    this.lastHeartbeat.getTime() < Date.now() - 10_000 /* TODO */
                ) this.instance.transition("onHeartbeatTimeout");
            },
            10_000 /* TODO */
        );

        // TODO: remove
        this.instance.options.logger?.debug(
            util.inspect({
                listenerCounts: {
                    close: this.instance.context.webSocket!.listenerCount("close"),
                    message: this.instance.context.webSocket!.listenerCount("message"),
                },
            }, { compact: true, colors: true })
        );
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
        this.instance.context.webSocket!
            .removeListener("message", this.onMessageListener!);
        clearInterval(this.heartbeatCheckInterval!);
    }

    public override onWebSocketClose() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

    public override onHeartbeatTimeout() {
        this.cleanUpListeners();
        return new ReconnectingWebSocketTimeoutedState(this.instance);
    }

}

class ReconnectingWebSocketTimeoutedState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Timeouted";
    }

    public handle(): void {}

}

type ReconnectingWebSocketInternalsEvent =
    `transitionedFrom${
        ReconnectingWebSocketStateName
    }To${
        ReconnectingWebSocketStateName
    }`;

class ReconnectingWebSocketInternals {

    public options: ReconnectingWebSocketOptions;
    public context: ReconnectingWebSocketContext;
    public state: ReconnectingWebSocketState;
    public events: EventEmitter;

    constructor(options: ReconnectingWebSocketOptions) {
        this.options = options;
        this.context = {};
        this.state = new ReconnectingWebSocketIdleState(this);
        this.events = new EventEmitter();
    }

    public transition(
        actionName:
            ReconnectingWebSocketOperationNames |
            ReconnectingWebSocketEventNames,
        ...args: any
    ): void {
        const previousState = this.state;
        const nextState = previousState[actionName](...args);
        this.options.logger?.info(
            `transitioned from ${previousState.name} to ${nextState.name}`);
        this.events.emit(
            `transitionedFrom${previousState.name}To${nextState.name}`);
        this.state = nextState;
        this.state.handle();
    }

    public on(
        event:
            ReconnectingWebSocketInternalsEvent |
            "heartbeat" | "ticker",
        listener: () => void
    ): void {
        this.events.on(event, listener);
    }

    public once(
        event:
            ReconnectingWebSocketInternalsEvent |
            "heartbeat" | "ticker",
        listener: () => void
    ): void {
        this.events.once(event, listener);
    }

}

export declare interface ReconnectingWebSocket {

    on(
        event: "heartbeat",
        listener: (e: HeartbeatResponse) => void
    ): void;

    on(
        event: "ticker",
        listener: (e: TickerResponse) => void
    ): void;

    once(
        event: "heartbeat",
        listener: (e: HeartbeatResponse) => void
    ): void;

    once(
        event: "ticker",
        listener: (e: TickerResponse) => void
    ): void;

}

export class ReconnectingWebSocket {

    private internals: ReconnectingWebSocketInternals;

    constructor(options: ReconnectingWebSocketOptions) {
        this.internals = new ReconnectingWebSocketInternals(options);
    }

    public connect(): Promise<void> {
        if (!(this.internals.state instanceof ReconnectingWebSocketIdleState))
            return Promise.reject("wrong state" /* TODO: more reasonable error message */);

        return new Promise<void>((resolve, reject) => {
            this.internals.once(
                "transitionedFromConnectingToConnected",
                () => resolve()
            );
            this.internals.once(
                "transitionedFromConnectingToIdle",
                () => reject(/* TODO: more reasonable error message */)
            );
            this.internals.transition("connect");
        });
    }

    public subscribe(...productIds: string[]): Promise<void> {
        if (!(this.internals.state instanceof ReconnectingWebSocketConnectedState))
            return Promise.reject("wrong state" /* TODO: more reasonable error message */);

        return new Promise<void>((resolve, reject) => {
            this.internals.once(
                "transitionedFromSubscribingToSubscribed",
                () => resolve()
            );
            this.internals.once(
                "transitionedFromSubscribingToFailed",
                () => reject(/* TODO: more reasonable error message */)
            );
            this.internals.transition("subscribe", productIds);
        });
    }

    public on(
        event: "heartbeat" | "ticker",
        listener: (...args: any) => void
    ): void {
        this.internals.events.on(event, listener);
    }

    public once(
        event: "heartbeat" | "ticker",
        listener: (...args: any) => void
    ): void {
        this.internals.events.once(event, listener);
    }

}

(async () => {

    const logger = winston.createLogger({
        level: "debug",
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
        ),
        transports: [ new winston.transports.Console() ],
    });

    const socket = new ReconnectingWebSocket({
        logger,
        url: "wss://ws-feed.pro.coinbase.com",
        reconnectDelay: 1000,
        maxReconnectTries: 60,
    });

    socket.on("heartbeat", (e) =>
        logger.debug(util.inspect(e, { compact: true, colors: true })));
    socket.on("ticker", (e) =>
        logger.debug(util.inspect(e, { compact: true, colors: true })));

    await socket.connect();
    await socket.subscribe("ETH-USD", "DAI-USD");

})();

