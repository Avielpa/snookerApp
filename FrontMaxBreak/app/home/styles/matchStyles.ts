// app/home/styles/matchStyles.ts
import { StyleSheet } from 'react-native';

export const createMatchStyles = (COLORS: any) => StyleSheet.create({
    statusHeaderItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 10, 
        paddingHorizontal: 14, 
        marginTop: 12, 
        marginBottom: 6,
        marginHorizontal: 14,
        backgroundColor: 'rgba(255, 167, 38, 0.08)',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.textHeader,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    statusHeaderText: { 
        fontSize: 14, 
        fontFamily: 'PoppinsBold', 
        color: COLORS.textHeader, 
        marginLeft: 8, 
        textTransform: 'uppercase', 
        letterSpacing: 0.5,
    },
    roundHeaderItem: { 
        paddingVertical: 4, 
        paddingHorizontal: 14, 
        marginTop: 6, 
        marginBottom: 2,
        marginHorizontal: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 6,
    },
    roundHeaderText: { 
        fontSize: 13, 
        fontFamily: 'PoppinsMedium', 
        color: COLORS.textSecondary, 
        marginLeft: 4,
        letterSpacing: 0.2,
        opacity: 0.8,
    },
    matchItemContainer: { 
        marginVertical: 3, 
        marginHorizontal: 14,
    },
    playerRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 6, 
        marginTop: 2 
    },
    playerName: { 
        fontSize: 14, 
        fontFamily: 'PoppinsSemiBold', 
        color: COLORS.textPrimary, 
        flexShrink: 1, 
        flexBasis: '38%',
        lineHeight: 18,
    },
    playerLeft: { 
        textAlign: 'left', 
        marginRight: 6 
    },
    playerRight: { 
        textAlign: 'right', 
        marginLeft: 6, 
    },
    winnerText: { 
        fontFamily: 'PoppinsBold', 
        color: '#4CAF50',
    },
    score: { 
        fontSize: 16, 
        fontFamily: 'PoppinsBold', 
        color: COLORS.score, 
        textAlign: 'center', 
        paddingHorizontal: 6,
        minWidth: 45,
    },
    detailsRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: 6, 
        paddingTop: 6, 
        borderTopColor: 'rgba(255, 255, 255, 0.15)', 
        borderTopWidth: 0.5 
    },
    detailItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        flexShrink: 1, 
        paddingRight: 4 
    },
    detailText: { 
        fontSize: 12, 
        fontFamily: 'PoppinsSemiBold', 
        color: COLORS.textPrimary, 
        marginLeft: 4, 
        flexShrink: 1,
        opacity: 0.9,
    },
});
