export const cycleFocus = <T>(order: ReadonlyArray<T>, current: T, dir: 1 | -1): T => {
    const idx = order.indexOf(current);
    return order[(idx + dir + order.length) % order.length]!;
};
