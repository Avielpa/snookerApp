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
type ClearFavoritesCache   = typeof import('../services/favoritesService').clearFavoritesCache;

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
let clearFavoritesCache: ClearFavoritesCache;

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
    clearFavoritesCache   = mod.clearFavoritesCache;
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

// =============================================================================
// Tests 102–111: loadFavorites account-sync gap fix — 10 tests
//
// Root cause: favorites starred while logged out (or on a device before it
// linked to an account) lived only in the device/local layer and never
// reached UserFavorite, so other devices on the same account — and the
// backend notification query, which checks UserFavorite — never saw them.
// loadFavorites() now pushes the merged union back to the account whenever
// it detects the account is missing something the device/local layer has.
// =============================================================================

describe('loadFavorites — account-sync gap fix', () => {
    beforeEach(setupFavoritesModule);

    it('102 — pushes merged match_ids to the account when device has matches the account lacks', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [111, 222] } }) // device
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } });        // account (empty)
        await loadFavorites();
        const pushCall = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'user/favorites/matches/'
        );
        expect(pushCall).toBeDefined();
        expect(pushCall![1].match_ids.slice().sort((a: number, b: number) => a - b)).toEqual([111, 222]);
    });

    it('103 — pushes merged player_ids to the account when device has players the account lacks', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [7], match_ids: [] } })
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } });
        await loadFavorites();
        const pushCall = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'user/favorites/players/'
        );
        expect(pushCall).toBeDefined();
        expect(pushCall![1].player_ids).toContain(7);
    });

    it('104 — does NOT push when the account already has everything the device has', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [5], match_ids: [] } })
            .mockResolvedValueOnce({ data: { player_ids: [5], match_ids: [] } });
        await loadFavorites();
        const pushCalls = (mockApiPatch.mock.calls as any[][]).filter(
            (c) => c[0] === 'user/favorites/players/' || c[0] === 'user/favorites/matches/'
        );
        expect(pushCalls.length).toBe(0);
    });

    it('105 — does NOT push when logged out (no auth header)', async () => {
        mockGetAuthHeader.mockResolvedValue(null);
        mockApiGet.mockResolvedValueOnce({ data: { player_ids: [], match_ids: [999] } });
        await loadFavorites();
        const pushCalls = (mockApiPatch.mock.calls as any[][]).filter(
            (c) => c[0] === 'user/favorites/players/' || c[0] === 'user/favorites/matches/'
        );
        expect(pushCalls.length).toBe(0);
    });

    it('106 — includes locally-cached-only matches (not yet on device or account) in the push', async () => {
        mockAsyncGetItem.mockResolvedValue(JSON.stringify({ playerIds: [], matchIds: [321] }));
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } })
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } });
        await loadFavorites();
        const pushCall = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'user/favorites/matches/'
        );
        expect(pushCall![1].match_ids).toContain(321);
    });

    it('107 — pushes players and matches independently (only the one with a gap)', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [1], match_ids: [50] } })  // device
            .mockResolvedValueOnce({ data: { player_ids: [1], match_ids: [] } });   // account has player, not match
        await loadFavorites();
        const playerPush = (mockApiPatch.mock.calls as any[][]).find((c) => c[0] === 'user/favorites/players/');
        const matchPush  = (mockApiPatch.mock.calls as any[][]).find((c) => c[0] === 'user/favorites/matches/');
        expect(playerPush).toBeUndefined();
        expect(matchPush).toBeDefined();
    });

    it('108 — resolves without throwing when the account push fails', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [7] } })
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } });
        mockApiPatch.mockRejectedValue(new Error('server down'));
        await expect(loadFavorites()).resolves.toBeDefined();
    });

    it('109 — the returned merged favorites still contain the gap items regardless of push outcome', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [42] } })
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } });
        mockApiPatch.mockRejectedValue(new Error('server down'));
        const result = await loadFavorites();
        expect(result.matchIds).toContain(42);
    });

    it('110 — does not push an empty array when device and account both have nothing', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } })
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } });
        await loadFavorites();
        const pushCalls = (mockApiPatch.mock.calls as any[][]).filter(
            (c) => c[0] === 'user/favorites/players/' || c[0] === 'user/favorites/matches/'
        );
        expect(pushCalls.length).toBe(0);
    });

    it('111 — pushed player_ids payload is the full merged union, not just the new ones', async () => {
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [1, 2], match_ids: [] } }) // device
            .mockResolvedValueOnce({ data: { player_ids: [2, 3], match_ids: [] } }); // account
        await loadFavorites();
        const pushCall = (mockApiPatch.mock.calls as any[][]).find((c) => c[0] === 'user/favorites/players/');
        expect(pushCall![1].player_ids.slice().sort((a: number, b: number) => a - b)).toEqual([1, 2, 3]);
    });
});

// =============================================================================
// Tests 112–116: clearFavoritesCache — logout cross-account leak fix — 5 tests
//
// Without this, logging out and a different account logging in on the same
// device would inherit the previous account's local favorites on the next
// loadFavorites() merge, and (after the fix above) auto-push them onto the
// new account.
// =============================================================================

describe('clearFavoritesCache', () => {
    beforeEach(setupFavoritesModule);

    it('112 — removes the AsyncStorage cache key', async () => {
        const mockRemoveItem = jest.fn().mockResolvedValue(undefined);
        (require('@react-native-async-storage/async-storage').default as any).removeItem = mockRemoveItem;
        await clearFavoritesCache();
        expect(mockRemoveItem).toHaveBeenCalledWith('@maxbreak_favorites');
    });

    it('113 — resets in-memory cache so sync reads return false after clearing', async () => {
        mockApiGet.mockResolvedValue({ data: { player_ids: [5], match_ids: [] } });
        await loadFavorites();
        (require('@react-native-async-storage/async-storage').default as any).removeItem =
            jest.fn().mockResolvedValue(undefined);
        await clearFavoritesCache();
        const mod = require('../services/favoritesService');
        expect(mod.isPlayerFavouriteSync(5)).toBe(false);
    });

    it('114 — a subsequent loadFavorites() for a different account does not resurrect the old local matches', async () => {
        // First account favorites match 999 locally
        mockApiGet.mockResolvedValueOnce({ data: { player_ids: [], match_ids: [999] } });
        await loadFavorites();

        // Logout clears the cache
        (require('@react-native-async-storage/async-storage').default as any).removeItem =
            jest.fn().mockResolvedValue(undefined);
        await clearFavoritesCache();

        // New account logs in — device/account endpoints now report nothing
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } })
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } });
        const result = await loadFavorites();
        expect(result.matchIds).not.toContain(999);
    });

    it('115 — does not throw when AsyncStorage.removeItem fails', async () => {
        (require('@react-native-async-storage/async-storage').default as any).removeItem =
            jest.fn().mockRejectedValue(new Error('storage error'));
        await expect(clearFavoritesCache()).resolves.toBeUndefined();
    });

    it('116 — clearing an already-empty cache is a no-op that still resolves', async () => {
        (require('@react-native-async-storage/async-storage').default as any).removeItem =
            jest.fn().mockResolvedValue(undefined);
        await expect(clearFavoritesCache()).resolves.toBeUndefined();
    });

    it('117 — clears the device-level player favorites via PATCH with an empty array', async () => {
        (require('@react-native-async-storage/async-storage').default as any).removeItem =
            jest.fn().mockResolvedValue(undefined);
        await clearFavoritesCache();
        const call = (mockApiPatch.mock.calls as any[][]).find((c) => c[0] === 'device/favorites/players/');
        expect(call).toBeDefined();
        expect(call![1]).toEqual({ device_id: MOCK_DEVICE_ID, player_ids: [] });
    });

    it('118 — clears the device-level match favorites via PATCH with an empty array', async () => {
        (require('@react-native-async-storage/async-storage').default as any).removeItem =
            jest.fn().mockResolvedValue(undefined);
        await clearFavoritesCache();
        const call = (mockApiPatch.mock.calls as any[][]).find((c) => c[0] === 'device/favorites/matches/');
        expect(call).toBeDefined();
        expect(call![1]).toEqual({ device_id: MOCK_DEVICE_ID, match_ids: [] });
    });

    it('119 — does not throw when the device-level clear PATCH fails', async () => {
        mockApiPatch.mockRejectedValue(new Error('server down'));
        await expect(clearFavoritesCache()).resolves.toBeUndefined();
    });

    it('120 — a device-level leak (old account favorites still on DeviceToken) does not resurrect after clear + new account load', async () => {
        // Account A favorited match 999; it lives on the DEVICE row (not just local cache).
        mockApiGet.mockResolvedValueOnce({ data: { player_ids: [], match_ids: [999] } }); // device endpoint
        await loadFavorites();

        // Logout: clears local cache AND device-level row (device/favorites/* PATCH with [])
        await clearFavoritesCache();
        const deviceClearCalls = (mockApiPatch.mock.calls as any[][]).filter(
            (c) => c[0] === 'device/favorites/matches/'
        );
        expect(deviceClearCalls.length).toBeGreaterThan(0);
        expect(deviceClearCalls[deviceClearCalls.length - 1][1].match_ids).toEqual([]);

        // Account B logs in on the same device. Since the device row was actually
        // cleared server-side (simulated here by the endpoint now returning empty),
        // account B's merge must not see match 999 at all — closing the leak that
        // clearing only the local cache would have left open.
        mockGetAuthHeader.mockResolvedValue(MOCK_AUTH_HEADER);
        mockApiGet
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } }) // device (now cleared)
            .mockResolvedValueOnce({ data: { player_ids: [], match_ids: [] } }); // account B
        const result = await loadFavorites();
        expect(result.matchIds).not.toContain(999);

        const leakedPush = (mockApiPatch.mock.calls as any[][]).find(
            (c) => c[0] === 'user/favorites/matches/' && c[1].match_ids.includes(999)
        );
        expect(leakedPush).toBeUndefined();
    });
});
