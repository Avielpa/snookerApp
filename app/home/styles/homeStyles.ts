// app/home/styles/homeStyles.ts
import { createLayoutStyles } from './layoutStyles';
import { createFilterStyles } from './filterStyles';
import { createMatchStyles } from './matchStyles';

export const createStyles = (COLORS: any) => {
    const layoutStyles = createLayoutStyles(COLORS);
    const filterStyles = createFilterStyles(COLORS);
    const matchStyles = createMatchStyles(COLORS);
    
    return {
        ...layoutStyles,
        ...filterStyles,
        ...matchStyles,
    };
};
