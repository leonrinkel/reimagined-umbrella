export type HeartbeatChannel = {
    name: "heartbeat";
    product_ids: string[];
};

export type TickerChannel = {
    name: "ticker";
    product_ids: string[];
};

export type Channel = TickerChannel | HeartbeatChannel;

export type SubscribeRequest = {
    type: "subscribe";
    channels: Channel[];
};

export type SubscriptionsResponse = {
    type: "subscriptions";
    channels: Channel[];
};

export type HeartbeatResponse = {
    type: "heartbeat";
    sequence: number;
    last_trade_id: number;
    product_id: string;
    time: Date;
};

export type TickerResponse = {
    type: "ticker";
    sequence: number;
    product_id: string;
    price: string;
    open_24h: string;
    volume_24h: string;
    low_24h: string;
    high_24h: string;
    volume_30d: string;
    best_bid: string;
    best_ask: string;
    side: "buy" | "sell";
    time: Date;
    trade_id: number;
    last_size: string;
};
