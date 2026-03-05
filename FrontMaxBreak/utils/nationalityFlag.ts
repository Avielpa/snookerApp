// utils/nationalityFlag.ts
// Maps snooker.org nationality strings to flag emojis.
// Covers all nationalities present in the snooker.org player database.

const FLAG_MAP: Record<string, string> = {
    // British Isles (snooker heartlands — subdivided flags)
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'Northern Ireland': '🇬🇧',
    'Ireland': '🇮🇪',
    'Republic of Ireland': '🇮🇪',

    // Europe
    'Germany': '🇩🇪',
    'France': '🇫🇷',
    'Belgium': '🇧🇪',
    'Netherlands': '🇳🇱',
    'Spain': '🇪🇸',
    'Portugal': '🇵🇹',
    'Italy': '🇮🇹',
    'Austria': '🇦🇹',
    'Switzerland': '🇨🇭',
    'Poland': '🇵🇱',
    'Czech Republic': '🇨🇿',
    'Slovakia': '🇸🇰',
    'Hungary': '🇭🇺',
    'Romania': '🇷🇴',
    'Bulgaria': '🇧🇬',
    'Greece': '🇬🇷',
    'Turkey': '🇹🇷',
    'Russia': '🇷🇺',
    'Ukraine': '🇺🇦',
    'Denmark': '🇩🇰',
    'Sweden': '🇸🇪',
    'Norway': '🇳🇴',
    'Finland': '🇫🇮',
    'Iceland': '🇮🇸',
    'Malta': '🇲🇹',
    'Cyprus': '🇨🇾',
    'Estonia': '🇪🇪',
    'Latvia': '🇱🇻',
    'Lithuania': '🇱🇹',
    'Croatia': '🇭🇷',
    'Serbia': '🇷🇸',
    'Slovenia': '🇸🇮',

    // Asia
    'China': '🇨🇳',
    'Hong Kong': '🇭🇰',
    'Taiwan': '🇹🇼',
    'Japan': '🇯🇵',
    'South Korea': '🇰🇷',
    'Korea': '🇰🇷',
    'India': '🇮🇳',
    'Pakistan': '🇵🇰',
    'Thailand': '🇹🇭',
    'Philippines': '🇵🇭',
    'Malaysia': '🇲🇾',
    'Singapore': '🇸🇬',
    'Indonesia': '🇮🇩',
    'Vietnam': '🇻🇳',
    'Iran': '🇮🇷',
    'Iraq': '🇮🇶',
    'Saudi Arabia': '🇸🇦',
    'United Arab Emirates': '🇦🇪',
    'Israel': '🇮🇱',
    'Jordan': '🇯🇴',
    'Egypt': '🇪🇬',
    'Kazakhstan': '🇰🇿',

    // Americas
    'Canada': '🇨🇦',
    'USA': '🇺🇸',
    'United States': '🇺🇸',
    'Brazil': '🇧🇷',
    'Argentina': '🇦🇷',
    'Mexico': '🇲🇽',
    'Jamaica': '🇯🇲',
    'Trinidad and Tobago': '🇹🇹',

    // Oceania
    'Australia': '🇦🇺',
    'New Zealand': '🇳🇿',

    // Africa
    'South Africa': '🇿🇦',
    'Zimbabwe': '🇿🇼',
    'Nigeria': '🇳🇬',
    'Kenya': '🇰🇪',
    'Morocco': '🇲🇦',
};

export function getNationalityFlag(nationality: string | null | undefined): string {
    if (!nationality) return '';
    return FLAG_MAP[nationality] ?? '';
}
