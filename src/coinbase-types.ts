/**
 * @see https://docs.pro.coinbase.com/#subscribe
 */
export type HeartbeatChannel = {
    name: "heartbeat";
    product_ids: string[]; /** e.g. ETH-USD */
};

/**
 * @see https://docs.pro.coinbase.com/#subscribe
 */
export type TickerChannel = {
    name: "ticker";
    product_ids: string[]; /** e.g. ETH-USD */
};

export type Channel = TickerChannel | HeartbeatChannel;

/**
 * @see https://docs.pro.coinbase.com/#subscribe
 */
export type SubscribeRequest = {
    type: "subscribe";
    channels: Channel[];
};

/**
 * @see https://docs.pro.coinbase.com/#subscribe
 */
export type SubscriptionsResponse = {
    type: "subscriptions";
    channels: Channel[];
};

/**
 * @see https://docs.pro.coinbase.com/#the-heartbeat-channel
 */
export type HeartbeatResponse = {
    type: "heartbeat";
    sequence: number;
    last_trade_id: number;
    product_id: string; /** e.g. ETH-USD */
    time: Date;
};

/**
 * @see https://docs.pro.coinbase.com/#the-ticker-channel
 */
export type TickerResponse = {
    type: "ticker";
    sequence: number;
    product_id: string; /** e.g. ETH-USD */
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
