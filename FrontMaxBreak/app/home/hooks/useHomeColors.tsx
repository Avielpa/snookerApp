// app/home/hooks/useHomeColors.tsx
import { useColors } from '../../../contexts/ThemeContext';

export const useHomeColors = () => {
    const colors = useColors();
    return {
        background: 'transparent',
        cardBackground: colors.cardBackground,
        cardBorder: colors.cardBorder,
        textHeader: colors.textHeader,
        textPrimary: colors.textPrimary,
        textSecondary: colors.textSecondary,
        textMuted: colors.textMuted,
        score: colors.primary,
        accent: colors.primary,
        accentLight: colors.secondary,
        live: colors.live,
        onBreak: colors.onBreak,
        error: colors.error,
        white: colors.white,
        black: colors.black,
        filterButton: colors.filterButton,
        filterButtonActive: colors.filterButtonActive,
        filterText: colors.filterText,
        filterTextActive: colors.filterTextActive,
    };
};
