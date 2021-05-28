export const TimeReviver =
    (key: string, value: string) => {
        if (
            key === "time" &&
            typeof value === "string"
        ) return new Date(value);
        return value;
    };
