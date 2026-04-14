// services/commentService.ts
import { api } from './api';
import { logger } from '../utils/logger';

export interface Comment {
    id: number;
    author_name: string;
    text: string;
    created_at: string;
    likes_count: number;
    liked_by_me: boolean;
    is_mine: boolean;
}

export async function getComments(matchApiId: number, deviceId: string): Promise<Comment[]> {
    try {
        const response = await api.get(`matches/${matchApiId}/comments/`, {
            params: { device_id: deviceId },
        });
        return response.data;
    } catch (error) {
        logger.error('[commentService] getComments failed:', error);
        throw error;
    }
}

export async function postComment(
    matchApiId: number,
    deviceId: string,
    authorName: string,
    text: string,
): Promise<Comment> {
    const response = await api.post(`matches/${matchApiId}/comments/`, {
        device_id: deviceId,
        author_name: authorName,
        text,
    });
    return response.data;
}

export async function deleteComment(
    matchApiId: number,
    commentId: number,
    deviceId: string,
): Promise<void> {
    await api.delete(`matches/${matchApiId}/comments/${commentId}/`, {
        data: { device_id: deviceId },
    });
}

export async function toggleLike(
    matchApiId: number,
    commentId: number,
    deviceId: string,
): Promise<{ liked: boolean; likes_count: number }> {
    const response = await api.post(`matches/${matchApiId}/comments/${commentId}/like/`, {
        device_id: deviceId,
    });
    return response.data;
}
