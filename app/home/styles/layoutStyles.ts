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
        paddingBottom: 2, 
        paddingHorizontal: 16 
    },
    screenTitle: { 
        fontSize: 26, 
        fontFamily: 'PoppinsBold', 
        textAlign: 'center', 
        color: COLORS.textHeader, 
        marginTop: 4, 
        marginBottom: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        letterSpacing: 0.3,
    },
    tourTitle: { 
        fontSize: 15, 
        fontFamily: 'PoppinsMedium', 
        textAlign: 'center', 
        color: COLORS.textSecondary, 
        marginBottom: 2,
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
        opacity: 0.95,
    },
    prizeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(255, 167, 38, 0.15)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 167, 38, 0.3)',
        alignSelf: 'center',
    },
    prizeText: {
        fontSize: 12,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.accentLight,
        marginLeft: 4,
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
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
