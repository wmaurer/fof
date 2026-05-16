import { Array } from "effect";

export const cycleFocus = <T>(order: Array.NonEmptyReadonlyArray<T>, current: T, dir: 1 | -1): T => {
    const idx = order.indexOf(current);
    return Array.getUnsafe(order, (idx + dir + order.length) % order.length);
};
