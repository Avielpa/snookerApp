// app/home/styles/filterStyles.ts
import { StyleSheet } from 'react-native';

export const createFilterStyles = (COLORS: any) => StyleSheet.create({
    filterContainer: { 
        paddingVertical: 4, 
        paddingHorizontal: 14, 
    },
    filterScrollView: { 
        flexDirection: 'row', 
        alignItems: 'center', 
    },
    filterButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: COLORS.filterButton, 
        paddingVertical: 4, 
        paddingHorizontal: 8, 
        borderRadius: 16, 
        marginRight: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 167, 38, 0.25)',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    filterButtonActive: { 
        backgroundColor: COLORS.filterButtonActive,
        borderColor: COLORS.accent,
        elevation: 2,
        shadowOpacity: 0.15,
    },
    filterText: { 
        color: COLORS.filterText, 
        fontSize: 11, 
        fontFamily: 'PoppinsMedium', 
        marginLeft: 4,
        letterSpacing: 0.1,
    },
    filterTextActive: { 
        color: COLORS.filterTextActive, 
        fontFamily: 'PoppinsBold',
    },
    otherToursContainer: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    otherToursScrollView: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    otherTourChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 14,
        marginRight: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 167, 38, 0.2)',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    otherTourChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
        elevation: 2,
        shadowOpacity: 0.1,
    },
    otherTourText: {
        fontSize: 10,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textSecondary,
        letterSpacing: 0.1,
    },
    otherTourTextActive: {
        color: COLORS.white,
        fontFamily: 'PoppinsBold',
    },
});
