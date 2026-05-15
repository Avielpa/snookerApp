import React, { createContext, useContext, useState } from 'react';

interface GameContextType {
  isGameActive: boolean;
  setGameActive: (active: boolean) => void;
}

const GameContext = createContext<GameContextType>({
  isGameActive: false,
  setGameActive: () => {},
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [isGameActive, setGameActive] = useState(false);
  return (
    <GameContext.Provider value={{ isGameActive, setGameActive }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  return useContext(GameContext);
}
