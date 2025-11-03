// utils/unifiedStyles.ts
import { StyleSheet } from 'react-native';

export const createUnifiedFilterStyles = (colors: any) => StyleSheet.create({
  // Core filter styles that work consistently across all screens
  filterButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.cardBackground, 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    elevation: 2,
    shadowOpacity: 0.15,
  },
  filterText: { 
    color: colors.filterText, 
    fontSize: 12, 
    fontFamily: 'PoppinsMedium', 
    marginLeft: 4,
    letterSpacing: 0.1,
  },
  filterTextActive: { 
    color: colors.filterTextActive, 
    fontFamily: 'PoppinsBold',
  },
  filterContainer: {
    marginVertical: 8,
  },
  filterScrollView: {
    paddingRight: 16,
  },
});