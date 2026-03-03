import { api } from './api';
import { NewsArticle } from '../app/components/news/newsUtils';
import { logger } from '../utils/logger';

export async function fetchAllNews(): Promise<NewsArticle[]> {
    try {
        const response = await api.get('news/');
        return response.data as NewsArticle[];
    } catch (e) {
        logger.warn(`[News] Failed to fetch news from backend: ${e}`);
        return [];
    }
}
