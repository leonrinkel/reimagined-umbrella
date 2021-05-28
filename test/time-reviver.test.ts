import { expect } from "chai";
import { TimeReviver } from "../src/time-reviver";

describe("TimeReviver", () => {
    it("should revive ISO strings to Date objects", () => {
        const expected = new Date(1622209099460);
        const actual = TimeReviver("time", expected.toISOString());
        expect(actual instanceof Date);
        expect((actual as Date).getTime()).to.equal(expected.getTime());
    });
});
