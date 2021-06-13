import { EventEmitter } from "events";
import ws from "ws";

type ReconnectingWebSocketOperationNames =
    "connect" | "reconnect";
type ReconnectingWebSocketOperations =
    Record<ReconnectingWebSocketOperationNames, () => void>;

type ReconnectingWebSocketEventNames =
    "onWebSocketOpen" | "onWebSocketError" | "onWebSocketClose";
type ReconnectingWebSocketEvents =
    Record<ReconnectingWebSocketEventNames, () => void>;

type ReconnectingWebSocketOptions = {
    url: string;
    reconnectDelay: number;
    maxReconnectTries: number;
};

type ReconnectingWebSocketContext = {
    webSocket?: ws;
    reconnectTries?: number;
};

type ReconnectingWebSocketStateName =
    "Idle" |
    "Connecting" |
    "Connected" |
    "Failed" |
    "Disconnected" |
    "Reconnecting" |
    "Reconnected" |
    "WaitingToReconnect";

abstract class ReconnectingWebSocketState
    implements ReconnectingWebSocketOperations, ReconnectingWebSocketEvents {

    protected instance: ReconnectingWebSocketInternals;

    constructor(instance: ReconnectingWebSocketInternals) {
        this.instance = instance;
    }

    public abstract get name(): ReconnectingWebSocketStateName;

    public abstract handle(): void;

    public connect(): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public reconnect(): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketOpen(): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketError(): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

    public onWebSocketClose(): ReconnectingWebSocketState {
        throw new Error("Unsupported Operation.");
    }

}

class ReconnectingWebSocketIdleState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Idle";
    }

    public handle(): void {}

    public override connect(): ReconnectingWebSocketConnectingState {
        return new ReconnectingWebSocketConnectingState(this.instance);
    }

}

class ReconnectingWebSocketConnectingState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Connecting";
    }

    public handle(): void {
        this.instance.context.webSocket = new ws(this.instance.options.url);
        this.instance.context.webSocket.once("open",
            () => this.instance.onWebSocketOpen());
        this.instance.context.webSocket.once("error",
            () => this.instance.onWebSocketError());
    }

    public override onWebSocketOpen(): ReconnectingWebSocketConnectedState {
        return new ReconnectingWebSocketConnectedState(this.instance);
    }

    public override onWebSocketError(): ReconnectingWebSocketIdleState {
        return new ReconnectingWebSocketIdleState(this.instance);
    }

}

class ReconnectingWebSocketConnectedState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Connected";
    }

    public handle(): void {
        this.instance.context.webSocket!.once("close",
            () => this.instance.onWebSocketClose());
    }

    public override onWebSocketClose(): ReconnectingWebSocketDisconnectedState {
        return new ReconnectingWebSocketDisconnectedState(this.instance);
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
        this.instance.context.reconnectTries = 0;
        setTimeout(() => this.instance.reconnect());
    }

    public override reconnect(): ReconnectingWebSocketReconnectingState {
        return new ReconnectingWebSocketReconnectingState(this.instance);
    }

}

class ReconnectingWebSocketReconnectingState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Reconnecting";
    }

    public handle(): void {
        this.instance.context.webSocket!.removeAllListeners();
        this.instance.context.webSocket = new ws(this.instance.options.url);
        this.instance.context.webSocket.once("open",
            () => this.instance.onWebSocketOpen());
        this.instance.context.webSocket.once("error",
            () => this.instance.onWebSocketError());
    }

    public override onWebSocketOpen(): ReconnectingWebSocketReconnectedState {
        return new ReconnectingWebSocketReconnectedState(this.instance);
    }

    public override onWebSocketError():
        ReconnectingWebSocketWaitingToReconnectState |
        ReconnectingWebSocketFailedState {
        if (
            this.instance.context.reconnectTries! <
            this.instance.options.maxReconnectTries
        ) return new ReconnectingWebSocketWaitingToReconnectState(this.instance);
        else return new ReconnectingWebSocketFailedState(this.instance);
    }

}

class ReconnectingWebSocketReconnectedState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "Reconnected";
    }

    public handle(): void {
        this.instance.context.webSocket!.once("close",
            () => this.instance.onWebSocketClose());
    }

    public override onWebSocketClose(): ReconnectingWebSocketDisconnectedState {
        return new ReconnectingWebSocketDisconnectedState(this.instance);
    }

}

class ReconnectingWebSocketWaitingToReconnectState
    extends ReconnectingWebSocketState {

    public get name(): ReconnectingWebSocketStateName {
        return "WaitingToReconnect";
    }

    public handle(): void {
        this.instance.context.reconnectTries! += 1;
        setTimeout(
            () => this.instance.reconnect(),
            this.instance.options.reconnectDelay
        );
    }

    public override reconnect(): ReconnectingWebSocketReconnectingState {
        return new ReconnectingWebSocketReconnectingState(this.instance);
    }

}

type ReconnectingWebSocketInternalsEvent =
    `transitionedFrom${
        ReconnectingWebSocketStateName
    }To${
        ReconnectingWebSocketStateName
    }`;

class ReconnectingWebSocketInternals
    implements ReconnectingWebSocketOperations, ReconnectingWebSocketEvents {

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

    private transition(
        actionName:
            ReconnectingWebSocketOperationNames |
            ReconnectingWebSocketEventNames
    ): void {
        const previousState = this.state;
        const nextState = previousState[actionName]();
        this.events.emit(
            `transitionedFrom${previousState.name}To${nextState.name}`);
        this.state = nextState;
        this.state.handle();
    }

    public connect(): void { this.transition("connect"); }
    public reconnect(): void { this.transition("reconnect"); }

    public onWebSocketOpen(): void { this.transition("onWebSocketOpen"); }
    public onWebSocketError(): void { this.transition("onWebSocketError"); }
    public onWebSocketClose(): void { this.transition("onWebSocketClose"); }

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
            this.internals.connect();
        });
    }

}

const socket = new ReconnectingWebSocket({
    url: "wss://ws-feed.pro.coinbase.com",
    reconnectDelay: 1000,
    maxReconnectTries: 60,
});
socket
    .connect()
    .then(() => console.log("😊"))
    .catch(() => console.log("😩"));
