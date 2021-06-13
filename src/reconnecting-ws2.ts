import { EventEmitter } from "events";
import util from "util";
import winston from "winston";
import ws from "ws";
import {
    Channel, SubscribeRequest,
    SubscriptionsResponse
} from "./coinbase-types";

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
    "onSubscriptionFailed";
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
    subscribedChannels?: Channel[];
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
    "Subscribed";

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

    public override onWebSocketOpen() {
        this.instance.context.webSocket!
            .removeListener("open", this.onOpenListener!);
        this.instance.context.webSocket!
            .removeListener("error", this.onErrorListener!);

        return new ReconnectingWebSocketConnectedState(this.instance);
    }

    public override onWebSocketError() {
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

    public override onWebSocketClose() {
        this.instance.context.webSocket
            ?.removeListener("close", this.onCloseListener!);

        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

    public override subscribe(request: SubscribeRequest) {
        this.instance.context.webSocket
            ?.removeListener("close", this.onCloseListener!);

        return new ReconnectingWebSocketSubscribingState(this.instance, request);
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

    public override onWebSocketOpen() {
        this.instance.context.webSocket!
            .removeListener("open", this.onOpenListener!);
        this.instance.context.webSocket!
            .removeListener("error", this.onErrorListener!);

        return new ReconnectingWebSocketReconnectedState(this.instance);
    }

    public override onWebSocketError() {
        this.instance.context.webSocket!
            .removeListener("open", this.onOpenListener!);
        this.instance.context.webSocket!
            .removeListener("error", this.onErrorListener!);

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

        // TODO: remove
        this.instance.options.logger?.debug(
            util.inspect({
                listenerCounts: {
                    close: this.instance.context.webSocket!.listenerCount("close"),
                },
            }, { compact: true, colors: true })
        );
    }

    public override onWebSocketClose() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);

        return new ReconnectingWebSocketDisconnectedState(this.instance);
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

    private request: SubscribeRequest;

    private onCloseListener?: () => void;
    private onMessageListener?: (data: ws.Data) => void;

    constructor(
        instance: ReconnectingWebSocketInternals,
        request: SubscribeRequest
    ) {
        super(instance);
        this.request = request;
    }

    public get name(): ReconnectingWebSocketStateName {
        return "Subscribing";
    }

    public handle(): void {
        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.onMessageListener = (data: ws.Data): void => {
            const message = JSON.parse(data.toString("utf-8"));
            if (message.type !== "subscriptions") return;
            const response = message as SubscriptionsResponse;

            const subscriptionSuccessful =
                this.request.channels.every(requestedChannel => {
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
            .send(JSON.stringify(this.request));
    }

    public override onWebSocketClose() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
        this.instance.context.webSocket!
            .removeListener("message", this.onMessageListener!);

        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

    public override onSubscribed(response: SubscriptionsResponse) {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
        this.instance.context.webSocket!
            .removeListener("message", this.onMessageListener!);

        this.instance.context.subscribedChannels = response.channels;
        return new ReconnectingWebSocketSubscribedState(this.instance);
    }

    public override onSubscriptionFailed() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
        this.instance.context.webSocket!
            .removeListener("message", this.onMessageListener!);

        return new ReconnectingWebSocketFailedState(this.instance);
    }

}

class ReconnectingWebSocketSubscribedState
    extends ReconnectingWebSocketState {

    private onCloseListener?: () => void;

    public get name(): ReconnectingWebSocketStateName {
        return "Subscribed";
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
                },
            }, { compact: true, colors: true })
        );
    }

    public override onWebSocketClose() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);

        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

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

    private events: EventEmitter;

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
        this.options.logger?.debug(
            `transitioned from ${previousState.name} to ${nextState.name}`);
        this.events.emit(
            `transitionedFrom${previousState.name}To${nextState.name}`);
        this.state = nextState;
        this.state.handle();
    }

    public on(
        event: ReconnectingWebSocketInternalsEvent,
        listener: () => void
    ): void {
        this.events.on(event, listener);
    }

    public once(
        event: ReconnectingWebSocketInternalsEvent,
        listener: () => void
    ): void {
        this.events.once(event, listener);
    }

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

    public subscribe(request: SubscribeRequest): Promise<void> {
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
            this.internals.transition("subscribe", request);
        });
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
    await socket.connect();
    await socket.subscribe({
        type: "subscribe",
        channels: [
            { name: "heartbeat", product_ids: [ "ETH-USD" ] },
        ],
    }); // TODO: only pass product_ids

})();

