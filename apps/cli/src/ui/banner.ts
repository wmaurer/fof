const GLYPHS: Record<string, ReadonlyArray<string>> = {
    F: ["#####", "#    ", "###  ", "#    ", "#    "],
    I: ["#####", "  #  ", "  #  ", "  #  ", "#####"],
    S: [" ####", "#    ", " ### ", "    #", "#### "],
    T: ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
    O: [" ### ", "#   #", "#   #", "#   #", " ### "],
    V: ["#   #", "#   #", "#   #", " # # ", "  #  "],
    E: ["#####", "#    ", "###  ", "#    ", "#####"],
    "0": [" ### ", "#   #", "#   #", "#   #", " ### "],
    "1": ["  #  ", " ##  ", "  #  ", "  #  ", " ### "],
    "2": [" ### ", "#   #", "   # ", "  #  ", "#####"],
    "3": [" ### ", "#   #", "  ## ", "#   #", " ### "],
    "4": ["#   #", "#   #", "#####", "    #", "    #"],
    "5": ["#####", "#    ", "#### ", "    #", "#### "],
    " ": ["     ", "     ", "     ", "     ", "     "],
};

export type BannerOptions = { readonly scale?: number };

export function renderBanner(text: string, options?: BannerOptions): string {
    const scale = options?.scale ?? 1;
    const rows = [0, 1, 2, 3, 4].map((row) =>
        text
            .split("")
            .map((ch) => GLYPHS[ch]?.[row] ?? "     ")
            .join(" "),
    );
    if (scale === 1) return rows.join("\n");
    return rows
        .flatMap((line) => {
            const widened = line
                .split("")
                .flatMap((c) => Array<string>(scale).fill(c))
                .join("");
            return Array<string>(scale).fill(widened);
        })
        .join("\n");
}
