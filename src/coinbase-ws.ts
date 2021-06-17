/* TODO: comment */

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

type CoinbaseWebSocketOperationNames =
    "connect" |
    "reconnect" |
    "subscribe";
type CoinbaseWebSocketOperations =
    Record<CoinbaseWebSocketOperationNames, (...args: any) => void>;

type CoinbaseWebSocketEventNames =
    "onWebSocketOpen" |
    "onWebSocketError" |
    "onWebSocketClose" |
    "onSubscribed" |
    "onSubscriptionFailed" |
    "onHeartbeatTimeout";
type CoinbaseWebSocketEvents =
    Record<CoinbaseWebSocketEventNames, (...args: any) => void>;

type CoinbaseWebSocketOptions = {
    logger?: winston.Logger;
    url: string;
    reconnectDelay: number;
    maxReconnectTries: number;
    timeoutInterval: number;
};

type CoinbaseWebSocketContext = {
    webSocket?: ws;
    reconnectTries?: number;
    productIds?: string[];
};

type CoinbaseWebSocketStateName =
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

abstract class CoinbaseWebSocketState
    implements CoinbaseWebSocketOperations, CoinbaseWebSocketEvents {

    protected instance: CoinbaseWebSocketInternals;

    constructor(instance: CoinbaseWebSocketInternals) {
        this.instance = instance;
    }

    public abstract get name(): CoinbaseWebSocketStateName;

    public abstract handle(): void;

    public connect(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public reconnect(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public subscribe(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketOpen(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketError(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketClose(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onSubscribed(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onSubscriptionFailed(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onHeartbeatTimeout(...args: any): CoinbaseWebSocketState {
        throw new Error("Unsupported Operation.");
    }

}

class CoinbaseWebSocketIdleState
    extends CoinbaseWebSocketState {

    public get name(): CoinbaseWebSocketStateName {
        return "Idle";
    }

    public handle(): void {}

    public override connect() {
        return new CoinbaseWebSocketConnectingState(this.instance);
    }

}

class CoinbaseWebSocketConnectingState
    extends CoinbaseWebSocketState {

    private onOpenListener?: () => void;
    private onErrorListener?: () => void;

    public get name(): CoinbaseWebSocketStateName {
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
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("open", this.onOpenListener!);
        this.instance.context.webSocket!
            .removeListener("error", this.onErrorListener!);
    }

    public override onWebSocketOpen() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketConnectedState(this.instance);
    }

    public override onWebSocketError() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketIdleState(this.instance);
    }

}

class CoinbaseWebSocketConnectedState
    extends CoinbaseWebSocketState {

    private onCloseListener?: () => void;

    public get name(): CoinbaseWebSocketStateName {
        return "Connected";
    }

    public handle(): void {
        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.instance.context.webSocket!.on("close", this.onCloseListener);
    }

    private cleanUpListeners() {
        this.instance.context.webSocket
            ?.removeListener("close", this.onCloseListener!);
    }

    public override onWebSocketClose() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketDisconnectedState(this.instance);
    }

    public override subscribe(productIds: string[]) {
        this.cleanUpListeners();
        return new CoinbaseWebSocketSubscribingState(this.instance, productIds);
    }

}

class CoinbaseWebSocketFailedState
    extends CoinbaseWebSocketState {

    public get name(): CoinbaseWebSocketStateName {
        return "Failed";
    }

    public handle(): void {
        this.instance.events.emit("failure");
    }

}

class CoinbaseWebSocketDisconnectedState
    extends CoinbaseWebSocketState {

    public get name(): CoinbaseWebSocketStateName {
        return "Disconnected";
    }

    public handle(): void {
        setTimeout(() => this.instance.transition("reconnect"));
    }

    public override reconnect() {
        this.instance.context.reconnectTries = 0;
        return new CoinbaseWebSocketReconnectingState(this.instance);
    }

}

class CoinbaseWebSocketReconnectingState
    extends CoinbaseWebSocketState {

    private onOpenListener?: () => void;
    private onErrorListener?: () => void;

    public get name(): CoinbaseWebSocketStateName {
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
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("open", this.onOpenListener!);
        this.instance.context.webSocket!
            .removeListener("error", this.onErrorListener!);
    }

    public override onWebSocketOpen() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketReconnectedState(this.instance);
    }

    public override onWebSocketError() {
        this.cleanUpListeners();

        if (
            this.instance.context.reconnectTries! <
            this.instance.options.maxReconnectTries
        )
            return new CoinbaseWebSocketWaitingToReconnectState(this.instance);
        else return new CoinbaseWebSocketFailedState(this.instance);
    }

}

class CoinbaseWebSocketReconnectedState
    extends CoinbaseWebSocketState {

    private onCloseListener?: () => void;
    private transitionTimeout?: NodeJS.Timeout;

    public get name(): CoinbaseWebSocketStateName {
        return "Reconnected";
    }

    public handle(): void {
        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.instance.context.webSocket!.on("close", this.onCloseListener);

        this.transitionTimeout = setTimeout(() => this.instance
            .transition("subscribe", this.instance.context.productIds));
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
        clearTimeout(this.transitionTimeout!);
    }

    public override onWebSocketClose() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketDisconnectedState(this.instance);
    }

    public override subscribe(productIds: string[]) {
        this.cleanUpListeners();
        return new CoinbaseWebSocketSubscribingState(this.instance, productIds);
    }

}

class CoinbaseWebSocketWaitingToReconnectState
    extends CoinbaseWebSocketState {

    public get name(): CoinbaseWebSocketStateName {
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
        return new CoinbaseWebSocketReconnectingState(this.instance);
    }

}

class CoinbaseWebSocketSubscribingState
    extends CoinbaseWebSocketState {

    private onCloseListener?: () => void;
    private onMessageListener?: (data: ws.Data) => void;

    constructor(
        instance: CoinbaseWebSocketInternals,
        productIds: string[]
    ) {
        super(instance);
        this.instance.context.productIds = productIds;
    }

    public get name(): CoinbaseWebSocketStateName {
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
        return new CoinbaseWebSocketDisconnectedState(this.instance);
    }

    public override onSubscribed(response: SubscriptionsResponse) {
        this.cleanUpListeners();
        return new CoinbaseWebSocketSubscribedState(this.instance);
    }

    public override onSubscriptionFailed() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketFailedState(this.instance);
    }

}

class CoinbaseWebSocketSubscribedState
    extends CoinbaseWebSocketState {

    private onCloseListener?: () => void;
    private onMessageListener?: (data: ws.Data) => void;

    private lastHeartbeat?: Date;
    private heartbeatCheckInterval?: NodeJS.Timeout;

    public get name(): CoinbaseWebSocketStateName {
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

        this.heartbeatCheckInterval = setInterval(
            () => {
                if (
                    this.lastHeartbeat &&
                    this.lastHeartbeat.getTime() <
                        Date.now() - this.instance.options.timeoutInterval
                ) this.instance.transition("onHeartbeatTimeout");
            },
            this.instance.options.timeoutInterval
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
        return new CoinbaseWebSocketDisconnectedState(this.instance);
    }

    public override onHeartbeatTimeout() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketTimeoutedState(this.instance);
    }

}

class CoinbaseWebSocketTimeoutedState
    extends CoinbaseWebSocketState {

    private onCloseListener?: () => void;
    private reconnectTimeout?: NodeJS.Timeout;

    public get name(): CoinbaseWebSocketStateName {
        return "Timeouted";
    }

    public handle(): void {
        this.onCloseListener =
            () => this.instance.transition("onWebSocketClose");
        this.instance.context.webSocket!.on("close", this.onCloseListener);

        this.reconnectTimeout =
            setTimeout(() => this.instance.transition("reconnect"));
    }

    private cleanUpListeners() {
        this.instance.context.webSocket!
            .removeListener("close", this.onCloseListener!);
        clearTimeout(this.reconnectTimeout!);
    }

    public override onWebSocketClose() {
        this.cleanUpListeners();
        return new CoinbaseWebSocketDisconnectedState(this.instance);
    }

    public override reconnect() {
        this.cleanUpListeners();
        this.instance.context.reconnectTries = 0;
        return new CoinbaseWebSocketReconnectingState(this.instance);
    }

}

type CoinbaseWebSocketTransitionEvent =
    `transitionedFrom${
        CoinbaseWebSocketStateName
    }To${
        CoinbaseWebSocketStateName
    }`;

class CoinbaseWebSocketInternals {

    public options: CoinbaseWebSocketOptions;
    public context: CoinbaseWebSocketContext;
    public state: CoinbaseWebSocketState;
    public events: EventEmitter;

    constructor(options: CoinbaseWebSocketOptions) {
        this.options = options;
        this.context = {};
        this.state = new CoinbaseWebSocketIdleState(this);
        this.events = new EventEmitter();
    }

    public transition(
        actionName:
            CoinbaseWebSocketOperationNames |
            CoinbaseWebSocketEventNames,
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
            CoinbaseWebSocketTransitionEvent |
            "heartbeat" | "ticker" | "failed",
        listener: () => void
    ): void {
        this.events.on(event, listener);
    }

    public once(
        event:
            CoinbaseWebSocketTransitionEvent |
            "heartbeat" | "ticker" | "failed",
        listener: () => void
    ): void {
        this.events.once(event, listener);
    }

}

export declare interface CoinbaseWebSocket {

    on(
        event: "heartbeat",
        listener: (e: HeartbeatResponse) => void
    ): void;

    on(
        event: "ticker",
        listener: (e: TickerResponse) => void
    ): void;

    on(
        event: "failure",
        listener: () => void
    ): void;

    once(
        event: "heartbeat",
        listener: (e: HeartbeatResponse) => void
    ): void;

    once(
        event: "ticker",
        listener: (e: TickerResponse) => void
    ): void;

    once(
        event: "failure",
        listener: () => void
    ): void;

}

export class CoinbaseWebSocket {

    private internals: CoinbaseWebSocketInternals;

    constructor(options: CoinbaseWebSocketOptions) {
        this.internals = new CoinbaseWebSocketInternals(options);
    }

    public connect(): Promise<void> {
        if (!(this.internals.state instanceof CoinbaseWebSocketIdleState))
            return Promise.reject("cannot connect because the socket is " +
                "already in a connected state");

        return new Promise<void>((resolve, reject) => {
            this.internals.once(
                "transitionedFromConnectingToConnected",
                () => resolve()
            );
            this.internals.once(
                "transitionedFromConnectingToIdle",
                () => reject("connection failed")
            );
            this.internals.transition("connect");
        });
    }

    public subscribe(...productIds: string[]): Promise<void> {
        if (!(this.internals.state instanceof CoinbaseWebSocketConnectedState))
            return Promise.reject("cannot subscribe because the socket is " +
                "not in a connected state");

        return new Promise<void>((resolve, reject) => {
            this.internals.once(
                "transitionedFromSubscribingToSubscribed",
                () => resolve()
            );
            this.internals.once(
                "transitionedFromSubscribingToFailed",
                () => reject("subscription failed")
            );
            this.internals.transition("subscribe", productIds);
        });
    }

    public on(
        event: "heartbeat" | "ticker" | "failure",
        listener: (...args: any) => void
    ): void {
        this.internals.events.on(event, listener);
    }

    public once(
        event: "heartbeat" | "ticker" | "failure",
        listener: (...args: any) => void
    ): void {
        this.internals.events.once(event, listener);
    }

}
