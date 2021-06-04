/**
 * Reviver function for JSON.parse that will reinterpret fields with the key
 * "time" from timestamps to date objects
 * @param key field key
 * @param value field value
 * @returns original value or parsed date object if key is "time"
 */
export const TimeReviver =
    (key: string, value: string) => {
        if (
            key === "time" &&
            typeof value === "string"
        ) return new Date(value);
        return value;
    };
