// app/home/styles/layoutStyles.ts
import { StyleSheet } from 'react-native';

export const createLayoutStyles = (COLORS: any) => StyleSheet.create({
    container: { 
        flex: 1, 
    },
    backgroundImage: {
        flex: 1,
    },
    headerContainer: { 
        paddingBottom: 6, 
        paddingHorizontal: 16 
    },
    screenTitle: { 
        fontSize: 26, 
        fontFamily: 'PoppinsBold', 
        textAlign: 'center', 
        color: COLORS.textHeader, 
        marginTop: 8, 
        marginBottom: 2,
        textShadowColor: 'rgba(255, 167, 38, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        letterSpacing: 0.3,
    },
    tourTitle: { 
        fontSize: 15, 
        fontFamily: 'PoppinsMedium', 
        textAlign: 'center', 
        color: COLORS.textSecondary, 
        marginBottom: 8,
        letterSpacing: 0.2,
        opacity: 0.9,
    },
    listArea: { 
        flex: 1, 
    },
    centerContent: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 24 
    },
    messageText: { 
        textAlign: 'center', 
        fontSize: 14, 
        fontFamily: 'PoppinsRegular', 
        color: COLORS.textMuted, 
        marginTop: 12,
        lineHeight: 20,
    },
    retryButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 8, 
        paddingHorizontal: 16, 
        backgroundColor: COLORS.accent, 
        borderRadius: 6, 
        marginTop: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    retryButtonText: { 
        color: COLORS.white, 
        fontSize: 14, 
        fontFamily: 'PoppinsMedium', 
        marginLeft: 6 
    },
    listContentContainer: { 
        paddingBottom: 16 
    },
});
