import { useWindowSize } from "ink";
import { createContext, type ReactNode, useContext } from "react";

type Size = { readonly columns: number; readonly rows: number };

const TerminalSizeContext = createContext<Size | null>(null);

export function TerminalSizeProvider({ children, value }: { readonly children: ReactNode; readonly value: Size }) {
    return <TerminalSizeContext.Provider value={value}>{children}</TerminalSizeContext.Provider>;
}

export function useTerminalSize(): Size {
    const override = useContext(TerminalSizeContext);
    const native = useWindowSize();
    return override ?? native;
}
