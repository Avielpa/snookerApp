// __tests__/userFavoritesSync.test.ts
// 28 tests covering the user-account favorites sync and linkDevice changes.
//
// Strategy: jest.resetModules() in beforeEach gives each test a fresh module
// instance with a clean in-memory cache. jest.doMock registers new mock
// factories after the reset so that require() picks them up.

// ─── Type aliases for re-imported module functions ────────────────────────────
type LoadFavorites        = typeof import('../services/favoritesService').loadFavorites;
type SavePlayerFavorites  = typeof import('../services/favoritesService').savePlayerFavorites;
type SaveMatchFavorites   = typeof import('../services/favoritesService').saveMatchFavorites;
type TogglePlayerFavourite = typeof import('../services/favoritesService').togglePlayerFavourite;
type ToggleMatchFavourite  = typeof import('../services/favoritesService').toggleMatchFavourite;

// ─── Shared constants ─────────────────────────────────────────────────────────
const MOCK_DEVICE_ID = 'test-device-uuid-123';
// JWT with exp: 9999999999 (year 2286) — never expires during tests
const VALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.fake';
const MOCK_AUTH_HEADER = `Bearer ${VALID_TOKEN}`;

// ─── Module-level variables re-assigned in each beforeEach ───────────────────
let mockApiGet: jest.Mock;
let mockApiPatch: jest.Mock;
let mockGetAuthHeader: jest.Mock;
let mockGetDeviceId: jest.Mock;
let mockAsyncGetItem: jest.Mock;
let mockAsyncSetItem: jest.Mock;

let loadFavorites: LoadFavorites;
let savePlayerFavorites: SavePlayerFavorites;
let saveMatchFavorites: SaveMatchFavorites;
let togglePlayerFavourite: TogglePlayerFavourite;
let toggleMatchFavourite: ToggleMatchFavourite;

function setupFavoritesModule(): void {
    jest.resetModules();

    mockApiGet       = jest.fn().mockResolvedValue({ data: { player_ids: [], match_ids: [] } });
    mockApiPatch     = jest.fn().mockResolvedValue({ data: {} });
    mockGetAuthHeader = jest.fn().mockResolvedValue(null);
    mockGetDeviceId  = jest.fn().mockResolvedValue(MOCK_DEVICE_ID);
    mockAsyncGetItem = jest.fn().mockResolvedValue(null);
    mockAsyncSetItem = jest.fn().mockResolvedValue(undefined);

    jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
            getItem: mockAsyncGetItem,
            setItem: mockAsyncSetItem,
        },
    }));

    jest.doMock('../services/api', () => ({
        api: { get: mockApiGet, patch: mockApiPatch },
    }));

    jest.doMock('../services/authService', () => ({
        getAuthHeader: mockGetAuthHeader,
    }));

    jest.doMock('../utils/deviceIdentity', () => ({
        getOrCreateDeviceId: mockGetDeviceId,
    }));

    jest.doMock('../utils/logger', () => ({
        logger: { warn: jest.fn(), error: jest.fn() },
    }));

    const mod = require('../services/favoritesService');
    loadFavorites         = mod.loadFavorites;
    savePlayerFavorites   = mod.savePlayerFavorites;
    saveMatchFavorites    = mod.saveMatchFavorites;
    togglePlayerFavourite = mod.togglePlayerFavourite;
    toggleMatchFavourite  = mod.toggleMatchFavourite;
}

// =============================================================================
// Tests 73–82: loadFavorites — 10 tests
// =============================================================================

describe('loadFavorites', () => {
    beforeEach(setupFavoritesModule);

    it('73 — calls device favorites endpoint with the correct device ID', async () => {
        await loadFavorites();
        expect(mockApiGet).toHaveBeenCalledWith(
            `device/favorites/?device_id=${MOCK_DEVICE_ID}`
        );
    });

    it('74 — does NOT call user favorites endpoint when logged out', async () => {
        mockGetAuthHeader.mockResolvedValue(null);
        await loadFavorites();
        const userCalls = (mockApiGet.mock.calls as any[][]).filter(
            (c) => c[0] === 'user/favorites/'
        );
        expect(userCalls.length).toBe(0);
    });

    it('75 — calls user favorites endpoint when a valid auth header is present', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        await loadFavorites();
        const allPaths = (mockApiGet.mock.calls as any[][]).map((c) => c[0]);
        expect(allPaths).toContain('user/favorites/');
    });

    it('76 — merges device and user player_ids with no duplicates', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [1, 2], match_ids: [] } }) // device
            .mockResolvedValueOnce({ data: { player_ids: [2, 3], match_ids: [] } }); // user
        const result = await loadFavorites();
        expect(result.playerIds.slice().sort((a, b) => a - b)).toEqual([1, 2, 3]);
    });

    it('77 — merges local + device + user match_ids into a union set', async () => {
        mockAsyncGetItem.mockResolvedValue(JSON.stringify({ playerIds: [], matchIds: [5] }));
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [6] } })
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [7] } });
        const result = await loadFavorites();
        expect(result.matchIds.slice().sort((a, b) => a - b)).toEqual([5, 6, 7]);
    });

    it('78 — resolves without throwing when the device endpoint fails', async () => {
        mockApiGet.mockRejectedValueOnce(new Error('network error'));
        await expect(loadFavorites()).resolves.toBeDefined();
    });

    it('79 — still returns device data when the user endpoint fails', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [1], match_ids: [] } })
            .mockRejectedValueOnce(new Error('user endpoint down'));
        const result = await loadFavorites();
        expect(result.playerIds).toContain(1);
    });

    it('80 — returns local cache when both server endpoints fail', async () => {
        mockAsyncGetItem.mockResolvedValue(
            JSON.stringify({ playerIds: [99], matchIds: [88] })
        );
        mockApiGet.mockRejectedValue(new Error('all down'));
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        const result = await loadFavorites();
        expect(result.playerIds).toContain(99);
        expect(result.matchIds).toContain(88);
    });

    it('81 — persists merged result to AsyncStorage', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [1], match_ids: [] } })
            .mockResolvedValueOnce({ data: { player_ids: [2], match_ids: [] } });
        await loadFavorites();
        expect(mockAsyncSetItem).toHaveBeenCalled();
    });

    it('82 — handles missing player_ids / match_ids fields in server response', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: {} })
            .mockResolvedValueOnce({ data: {} });
        await expect(loadFavorites()).resolves.toBeDefined();
    });

    it('83 — returns empty arrays when all sources are empty', async () => {
        const result = await loadFavorites();
        expect(result.playerIds).toEqual([]);
        expect(result.matchIds).toEqual([]);
    });
});

// =============================================================================
// Tests 84–89: savePlayerFavorites — 6 tests
// =============================================================================

describe('savePlayerFavorites', () => {
    beforeEach(setupFavoritesModule);

    it('84 — writes updated player_ids to AsyncStorage', async () => {
        await savePlayerFavorites([1, 2, 3]);
        expect(mockAsyncSetItem).toHaveBeenCalledWith(
            '@maxbreak_favorites',
            expect.stringContaining('"playerIds":[1,2,3]')
        );
    });

    it('85 — calls device favorites/players endpoint with device_id and ids', async () => {
        await savePlayerFavorites([10, 20]);
        expect(mockApiPatch).toHaveBeenCalledWith(
            'device/favorites/players/',
            { device_id: MOCK_DEVICE_ID, player_ids: [10, 20] }
        );
    });

    it('86 — calls user favorites/players endpoint when logged in', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        await savePlayerFavorites([5, 6]);
        const userCall = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'user/favorites/players/'
        );
        expect(userCall).toBeDefined();
        expect(userCall![1]).toEqual({ player_ids: [5, 6] });
    });

    it('87 — does NOT call user endpoint when logged out', async () => {
        mockGetAuthHeader.mockResolvedValue(null);
        await savePlayerFavorites([5]);
        const userCalls = (mockApiPatch.mock.calls as any[][]).filter(
            (c) => c[0] === 'user/favorites/players/'
        );
        expect(userCalls.length).toBe(0);
    });

    it('88 — does not throw when device endpoint returns an error', async () => {
        mockApiPatch.mockRejectedValue(new Error('server down'));
        await expect(savePlayerFavorites([1])).resolves.toBeUndefined();
    });

    it('89 — does not throw when user endpoint returns an error', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiPatch.mockRejectedValue(new Error('server down'));
        await expect(savePlayerFavorites([1])).resolves.toBeUndefined();
    });
});

// =============================================================================
// Tests 90–95: saveMatchFavorites — 6 tests
// =============================================================================

describe('saveMatchFavorites', () => {
    beforeEach(setupFavoritesModule);

    it('90 — writes updated match_ids to AsyncStorage', async () => {
        await saveMatchFavorites([100, 200]);
        expect(mockAsyncSetItem).toHaveBeenCalledWith(
            '@maxbreak_favorites',
            expect.stringContaining('"matchIds":[100,200]')
        );
    });

    it('91 — calls device favorites/matches endpoint with device_id and ids', async () => {
        await saveMatchFavorites([300]);
        expect(mockApiPatch).toHaveBeenCalledWith(
            'device/favorites/matches/',
            { device_id: MOCK_DEVICE_ID, match_ids: [300] }
        );
    });

    it('92 — calls user favorites/matches endpoint when logged in', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        await saveMatchFavorites([400, 500]);
        const userCall = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'user/favorites/matches/'
        );
        expect(userCall).toBeDefined();
        expect(userCall![1]).toEqual({ match_ids: [400, 500] });
    });

    it('93 — does NOT call user endpoint when logged out', async () => {
        mockGetAuthHeader.mockResolvedValue(null);
        await saveMatchFavorites([1]);
        const userCalls = (mockApiPatch.mock.calls as any[][]).filter(
            (c) => c[0] === 'user/favorites/matches/'
        );
        expect(userCalls.length).toBe(0);
    });

    it('94 — does not throw when device endpoint returns an error', async () => {
        mockApiPatch.mockRejectedValue(new Error('server down'));
        await expect(saveMatchFavorites([1])).resolves.toBeUndefined();
    });

    it('95 — does not throw when user endpoint returns an error', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiPatch.mockRejectedValue(new Error('server down'));
        await expect(saveMatchFavorites([1])).resolves.toBeUndefined();
    });
});

// =============================================================================
// Tests 96–99: authService.linkDevice — 4 tests
// =============================================================================

describe('authService.linkDevice', () => {
    let mockAxiosPost: jest.Mock;
    let mockSecureStoreGet: jest.Mock;
    let linkDevice: typeof import('../services/authService').linkDevice;

    beforeEach(() => {
        jest.resetModules();
        // Remove the authService mock registered by setupFavoritesModule so we
        // can require the real implementation below.
        jest.unmock('../services/authService');

        mockAxiosPost    = jest.fn().mockResolvedValue({ data: {} });
        mockSecureStoreGet = jest.fn().mockImplementation((key: string) => {
            if (key === 'auth_access_token') return Promise.resolve(VALID_TOKEN);
            if (key === 'auth_refresh_token') return Promise.resolve('refresh-tok');
            return Promise.resolve(null);
        });

        jest.doMock('axios', () => ({
            __esModule: true,
            default: { post: mockAxiosPost },
            post: mockAxiosPost,
        }));

        jest.doMock('expo-secure-store', () => ({
            getItemAsync:    mockSecureStoreGet,
            setItemAsync:    jest.fn().mockResolvedValue(undefined),
            deleteItemAsync: jest.fn().mockResolvedValue(undefined),
        }));

        const mod = require('../services/authService');
        linkDevice = mod.linkDevice;
    });

    it('96 — posts to user/link-device/ with the correct device_id body', async () => {
        await linkDevice('my-device-uuid');
        expect(mockAxiosPost).toHaveBeenCalledWith(
            expect.stringContaining('user/link-device/'),
            { device_id: 'my-device-uuid' },
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: `Bearer ${VALID_TOKEN}` }),
            })
        );
    });

    it('97 — sends a Bearer Authorization header with the access token', async () => {
        await linkDevice('device-456');
        const [, , options] = mockAxiosPost.mock.calls[0] as any[];
        expect(options.headers.Authorization).toBe(`Bearer ${VALID_TOKEN}`);
    });

    it('98 — re-throws when the HTTP request fails', async () => {
        mockAxiosPost.mockRejectedValueOnce(new Error('network error'));
        await expect(linkDevice('device-fail')).rejects.toThrow('network error');
    });

    it('99 — throws when no access token is available (not logged in)', async () => {
        mockSecureStoreGet.mockResolvedValue(null);
        await expect(linkDevice('device-noauth')).rejects.toThrow();
    });
});

// =============================================================================
// Tests 100: toggle helpers — 1 test  (+ bonus = 101 to ensure ≥ 100)
// =============================================================================

describe('toggle helpers', () => {
    beforeEach(setupFavoritesModule);

    it('100 — togglePlayerFavourite adds player when not currently favorited', async () => {
        // Cache is empty (module freshly loaded, AsyncStorage returns null)
        const result = await togglePlayerFavourite(42);
        expect(result).toBe(true); // now favorited
        const deviceCall = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'device/favorites/players/'
        );
        expect(deviceCall).toBeDefined();
        expect(deviceCall![1].player_ids).toContain(42);
    });

    it('101 — toggleMatchFavourite removes match when already in cache', async () => {
        // Warm the cache by calling loadFavorites with server returning [99]
        mockApiGet.mockResolvedValue({ data: { player_ids: [], match_ids: [99] } });
        await loadFavorites();

        const result = await toggleMatchFavourite(99);
        expect(result).toBe(false); // now un-favorited
        const deviceCall = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'device/favorites/matches/'
        );
        expect(deviceCall).toBeDefined();
        expect(deviceCall![1].match_ids).not.toContain(99);
    });
});
