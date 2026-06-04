import { useEffect, useRef } from 'react';
import { GameState } from './useSnookerGame';

// Saves draft after every state change so a force-kill (swipe from recents,
// OS kill) always has a current draft in AsyncStorage.
// Skips the very first render (mount) to avoid a race with clearDraft() in
// the useFocusEffect focus callback.
export function useGameAutosave(state: GameState, saveDraftIfNeeded: () => void): void {
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    saveDraftIfNeeded();
  }, [state, saveDraftIfNeeded]);
}
