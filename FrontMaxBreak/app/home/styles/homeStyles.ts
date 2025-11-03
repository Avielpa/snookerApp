// app/home/styles/homeStyles.ts
import { createLayoutStyles } from './layoutStyles';
import { createFilterStyles } from './filterStyles';
import { createModernMatchStyles } from './modernMatchStyles';  // MODERN STYLES

export const createStyles = (COLORS: any) => {
    const layoutStyles = createLayoutStyles(COLORS);
    const filterStyles = createFilterStyles(COLORS);
    const matchStyles = createModernMatchStyles(COLORS);  // USE MODERN STYLES

    return {
        ...layoutStyles,
        ...filterStyles,
        ...matchStyles,
    };
};
