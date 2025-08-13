// app/home/utils/dateFormatting.ts

export const formatDate = (dateString: string | null): string => {
    if (!dateString || dateString === "Invalid Date Format" || dateString === null) {
        return 'TBD';
    }
    
    try {
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        return date.toLocaleString('en-GB', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch {
        return 'Date Error';
    }
};