// __tests__/signupNudge.test.ts
// 50 tests covering signupNudgeService: shouldShowSignupNudge, markSignupNudgeShown, resetSignupNudge.
//
// Strategy: jest.resetModules() + jest.doMock() in each beforeEach so every test
// gets a fresh module instance with isolated AsyncStorage mocks.

type ShouldShowSignupNudge = typeof import('../services/signupNudgeService').shouldShowSignupNudge;
type MarkSignupNudgeShown  = typeof import('../services/signupNudgeService').markSignupNudgeShown;
type ResetSignupNudge      = typeof import('../services/signupNudgeService').resetSignupNudge;

const EXPECTED_KEY = '@maxbreak_signup_nudge_shown';

let mockGetItem:    jest.Mock;
let mockSetItem:    jest.Mock;
let mockRemoveItem: jest.Mock;

let shouldShowSignupNudge: ShouldShowSignupNudge;
let markSignupNudgeShown:  MarkSignupNudgeShown;
let resetSignupNudge:      ResetSignupNudge;

function setupNudgeModule(): void {
    jest.resetModules();

    mockGetItem    = jest.fn().mockResolvedValue(null);
    mockSetItem    = jest.fn().mockResolvedValue(undefined);
    mockRemoveItem = jest.fn().mockResolvedValue(undefined);

    jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
            getItem:    mockGetItem,
            setItem:    mockSetItem,
            removeItem: mockRemoveItem,
        },
    }));

    const mod = require('../services/signupNudgeService');
    shouldShowSignupNudge = mod.shouldShowSignupNudge;
    markSignupNudgeShown  = mod.markSignupNudgeShown;
    resetSignupNudge      = mod.resetSignupNudge;
}

// =============================================================================
// Tests 102–116: shouldShowSignupNudge — 15 tests
// =============================================================================

describe('shouldShowSignupNudge', () => {
    beforeEach(setupNudgeModule);

    it('102 — returns true when AsyncStorage returns null (key not set)', async () => {
        mockGetItem.mockResolvedValue(null);
        expect(await shouldShowSignupNudge()).toBe(true);
    });

    it('103 — returns false when AsyncStorage returns "true" (nudge already shown)', async () => {
        mockGetItem.mockResolvedValue('true');
        expect(await shouldShowSignupNudge()).toBe(false);
    });

    it('104 — returns false when AsyncStorage returns "1"', async () => {
        mockGetItem.mockResolvedValue('1');
        expect(await shouldShowSignupNudge()).toBe(false);
    });

    it('105 — returns false when AsyncStorage returns an empty string (key exists)', async () => {
        mockGetItem.mockResolvedValue('');
        expect(await shouldShowSignupNudge()).toBe(false);
    });

    it('106 — returns false when AsyncStorage returns "yes"', async () => {
        mockGetItem.mockResolvedValue('yes');
        expect(await shouldShowSignupNudge()).toBe(false);
    });

    it('107 — returns false when AsyncStorage returns any non-null string', async () => {
        mockGetItem.mockResolvedValue('some-arbitrary-value');
        expect(await shouldShowSignupNudge()).toBe(false);
    });

    it('108 — calls getItem with the correct nudge key', async () => {
        await shouldShowSignupNudge();
        expect(mockGetItem).toHaveBeenCalledWith(EXPECTED_KEY);
    });

    it('109 — calls getItem exactly once per invocation', async () => {
        await shouldShowSignupNudge();
        expect(mockGetItem).toHaveBeenCalledTimes(1);
    });

    it('110 — returns true (not throws) when getItem rejects', async () => {
        mockGetItem.mockRejectedValue(new Error('storage unavailable'));
        expect(await shouldShowSignupNudge()).toBe(true);
    });

    it('111 — resolves without throwing even when getItem throws', async () => {
        mockGetItem.mockRejectedValue(new Error('crash'));
        await expect(shouldShowSignupNudge()).resolves.toBeDefined();
    });

    it('112 — resolves to boolean true when null is stored', async () => {
        mockGetItem.mockResolvedValue(null);
        const result = await shouldShowSignupNudge();
        expect(typeof result).toBe('boolean');
        expect(result).toBe(true);
    });

    it('113 — resolves to boolean false when a string is stored', async () => {
        mockGetItem.mockResolvedValue('true');
        const result = await shouldShowSignupNudge();
        expect(typeof result).toBe('boolean');
        expect(result).toBe(false);
    });

    it('114 — calling twice with null mock gives true both times', async () => {
        mockGetItem.mockResolvedValue(null);
        expect(await shouldShowSignupNudge()).toBe(true);
        expect(await shouldShowSignupNudge()).toBe(true);
    });

    it('115 — calling twice with "true" mock gives false both times', async () => {
        mockGetItem.mockResolvedValue('true');
        expect(await shouldShowSignupNudge()).toBe(false);
        expect(await shouldShowSignupNudge()).toBe(false);
    });

    it('116 — does not call setItem or removeItem', async () => {
        await shouldShowSignupNudge();
        expect(mockSetItem).not.toHaveBeenCalled();
        expect(mockRemoveItem).not.toHaveBeenCalled();
    });
});

// =============================================================================
// Tests 117–131: markSignupNudgeShown — 15 tests
// =============================================================================

describe('markSignupNudgeShown', () => {
    beforeEach(setupNudgeModule);

    it('117 — calls setItem with the correct nudge key', async () => {
        await markSignupNudgeShown();
        expect(mockSetItem).toHaveBeenCalledWith(EXPECTED_KEY, expect.any(String));
    });

    it('118 — calls setItem with value "true"', async () => {
        await markSignupNudgeShown();
        expect(mockSetItem).toHaveBeenCalledWith(EXPECTED_KEY, 'true');
    });

    it('119 — key is first argument, value is second argument', async () => {
        await markSignupNudgeShown();
        const [key, val] = mockSetItem.mock.calls[0] as [string, string];
        expect(key).toBe(EXPECTED_KEY);
        expect(val).toBe('true');
    });

    it('120 — resolves to undefined', async () => {
        const result = await markSignupNudgeShown();
        expect(result).toBeUndefined();
    });

    it('121 — does not throw when setItem rejects', async () => {
        mockSetItem.mockRejectedValue(new Error('disk full'));
        await expect(markSignupNudgeShown()).resolves.toBeUndefined();
    });

    it('122 — resolves (not rejects) even when setItem throws', async () => {
        mockSetItem.mockRejectedValue(new Error('crash'));
        await expect(markSignupNudgeShown()).resolves.toBeUndefined();
    });

    it('123 — does not call getItem', async () => {
        await markSignupNudgeShown();
        expect(mockGetItem).not.toHaveBeenCalled();
    });

    it('124 — does not call removeItem', async () => {
        await markSignupNudgeShown();
        expect(mockRemoveItem).not.toHaveBeenCalled();
    });

    it('125 — called once: setItem called once', async () => {
        await markSignupNudgeShown();
        expect(mockSetItem).toHaveBeenCalledTimes(1);
    });

    it('126 — called twice: setItem called twice (no dedup)', async () => {
        await markSignupNudgeShown();
        await markSignupNudgeShown();
        expect(mockSetItem).toHaveBeenCalledTimes(2);
    });

    it('127 — called three times: setItem called three times', async () => {
        await markSignupNudgeShown();
        await markSignupNudgeShown();
        await markSignupNudgeShown();
        expect(mockSetItem).toHaveBeenCalledTimes(3);
    });

    it('128 — second call writes same key and value as first call', async () => {
        await markSignupNudgeShown();
        await markSignupNudgeShown();
        const calls = mockSetItem.mock.calls as [string, string][];
        expect(calls[0]).toEqual([EXPECTED_KEY, 'true']);
        expect(calls[1]).toEqual([EXPECTED_KEY, 'true']);
    });

    it('129 — resolves even when storage first call fails, second succeeds', async () => {
        mockSetItem
            .mockRejectedValueOnce(new Error('first fail'))
            .mockResolvedValueOnce(undefined);
        await expect(markSignupNudgeShown()).resolves.toBeUndefined();
        await expect(markSignupNudgeShown()).resolves.toBeUndefined();
    });

    it('130 — takes no parameters', async () => {
        await expect((markSignupNudgeShown as () => Promise<void>)()).resolves.toBeUndefined();
    });

    it('131 — returns a Promise', () => {
        const result = markSignupNudgeShown();
        expect(result).toBeInstanceOf(Promise);
    });
});

// =============================================================================
// Tests 132–141: resetSignupNudge — 10 tests
// =============================================================================

describe('resetSignupNudge', () => {
    beforeEach(setupNudgeModule);

    it('132 — calls removeItem with the correct nudge key', async () => {
        await resetSignupNudge();
        expect(mockRemoveItem).toHaveBeenCalledWith(EXPECTED_KEY);
    });

    it('133 — calls removeItem exactly once per invocation', async () => {
        await resetSignupNudge();
        expect(mockRemoveItem).toHaveBeenCalledTimes(1);
    });

    it('134 — resolves to undefined', async () => {
        const result = await resetSignupNudge();
        expect(result).toBeUndefined();
    });

    it('135 — does not throw when removeItem rejects', async () => {
        mockRemoveItem.mockRejectedValue(new Error('storage error'));
        await expect(resetSignupNudge()).resolves.toBeUndefined();
    });

    it('136 — resolves even when removeItem throws', async () => {
        mockRemoveItem.mockRejectedValue(new Error('crash'));
        await expect(resetSignupNudge()).resolves.toBeUndefined();
    });

    it('137 — does not call getItem', async () => {
        await resetSignupNudge();
        expect(mockGetItem).not.toHaveBeenCalled();
    });

    it('138 — does not call setItem', async () => {
        await resetSignupNudge();
        expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('139 — called twice: removeItem called twice', async () => {
        await resetSignupNudge();
        await resetSignupNudge();
        expect(mockRemoveItem).toHaveBeenCalledTimes(2);
    });

    it('140 — resolves even when first call fails and second succeeds', async () => {
        mockRemoveItem
            .mockRejectedValueOnce(new Error('first fail'))
            .mockResolvedValueOnce(undefined);
        await expect(resetSignupNudge()).resolves.toBeUndefined();
        await expect(resetSignupNudge()).resolves.toBeUndefined();
    });

    it('141 — returns a Promise', () => {
        const result = resetSignupNudge();
        expect(result).toBeInstanceOf(Promise);
    });
});

// =============================================================================
// Tests 142–151: integration / lifecycle — 10 tests
// =============================================================================

describe('nudge lifecycle integration', () => {
    beforeEach(setupNudgeModule);

    it('142 — NUDGE_KEY exported constant equals expected storage key', () => {
        const mod = require('../services/signupNudgeService');
        expect(mod.NUDGE_KEY).toBe(EXPECTED_KEY);
    });

    it('143 — full lifecycle: null→show, string→hide, null→show again', async () => {
        mockGetItem.mockResolvedValueOnce(null);
        expect(await shouldShowSignupNudge()).toBe(true);

        mockGetItem.mockResolvedValueOnce('true');
        expect(await shouldShowSignupNudge()).toBe(false);

        mockGetItem.mockResolvedValueOnce(null);
        expect(await shouldShowSignupNudge()).toBe(true);
    });

    it('144 — stateful mock: mark sets key, shouldShow reads false', async () => {
        const store: Record<string, string> = {};
        mockGetItem.mockImplementation((k: string) => Promise.resolve(store[k] ?? null));
        mockSetItem.mockImplementation((k: string, v: string) => { store[k] = v; return Promise.resolve(); });

        expect(await shouldShowSignupNudge()).toBe(true);
        await markSignupNudgeShown();
        expect(await shouldShowSignupNudge()).toBe(false);
    });

    it('145 — stateful mock: mark then reset, shouldShow returns true again', async () => {
        const store: Record<string, string> = {};
        mockGetItem.mockImplementation((k: string) => Promise.resolve(store[k] ?? null));
        mockSetItem.mockImplementation((k: string, v: string) => { store[k] = v; return Promise.resolve(); });
        mockRemoveItem.mockImplementation((k: string) => { delete store[k]; return Promise.resolve(); });

        await markSignupNudgeShown();
        expect(await shouldShowSignupNudge()).toBe(false);

        await resetSignupNudge();
        expect(await shouldShowSignupNudge()).toBe(true);
    });

    it('146 — mark + reset sequence: both storage operations use same key', async () => {
        await markSignupNudgeShown();
        await resetSignupNudge();
        expect(mockSetItem.mock.calls[0][0]).toBe(EXPECTED_KEY);
        expect(mockRemoveItem.mock.calls[0][0]).toBe(EXPECTED_KEY);
    });

    it('147 — all three functions reference the same NUDGE_KEY', async () => {
        await shouldShowSignupNudge();
        await markSignupNudgeShown();
        await resetSignupNudge();
        const getKey = (mockGetItem.mock.calls[0] as [string])[0];
        const setKey = (mockSetItem.mock.calls[0] as [string, string])[0];
        const rmKey  = (mockRemoveItem.mock.calls[0] as [string])[0];
        expect(getKey).toBe(EXPECTED_KEY);
        expect(setKey).toBe(EXPECTED_KEY);
        expect(rmKey).toBe(EXPECTED_KEY);
    });

    it('148 — error in mark does not prevent subsequent shouldShow from resolving', async () => {
        mockSetItem.mockRejectedValue(new Error('mark failed'));
        await expect(markSignupNudgeShown()).resolves.toBeUndefined();
        mockGetItem.mockResolvedValue(null);
        await expect(shouldShowSignupNudge()).resolves.toBe(true);
    });

    it('149 — error in reset does not prevent subsequent mark from resolving', async () => {
        mockRemoveItem.mockRejectedValue(new Error('reset failed'));
        await expect(resetSignupNudge()).resolves.toBeUndefined();
        await expect(markSignupNudgeShown()).resolves.toBeUndefined();
        expect(mockSetItem).toHaveBeenCalledWith(EXPECTED_KEY, 'true');
    });

    it('150 — shouldShow always queries storage (no module-level in-memory cache)', async () => {
        await shouldShowSignupNudge();
        await shouldShowSignupNudge();
        await shouldShowSignupNudge();
        expect(mockGetItem).toHaveBeenCalledTimes(3);
    });

    it('151 — concurrent shouldShow calls all resolve to true when storage returns null', async () => {
        mockGetItem.mockResolvedValue(null);
        const results = await Promise.all([
            shouldShowSignupNudge(),
            shouldShowSignupNudge(),
            shouldShowSignupNudge(),
        ]);
        expect(results).toEqual([true, true, true]);
    });
});
