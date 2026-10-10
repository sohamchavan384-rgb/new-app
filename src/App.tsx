import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// Constants
const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'bg-green-500',
  medium: 'bg-yellow-500',
  hard: 'bg-red-500',
};

// Helper functions
function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

function getInitialSnake(): Position[] {
  const mid = Math.floor(GRID_SIZE / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
}

// Main App Component
export default function App() {
  const [snake, setSnake] = useState<Position[]>(getInitialSnake());
  const [food, setFood] = useState<Position>(() => getRandomPosition(getInitialSnake()));
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showControls, setShowControls] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameStateRef = useRef<GameState>('idle');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastMoveTimeRef = useRef<number>(0);

  // Sync refs
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-high-score', score.toString());
    }
  }, [score, highScore]);

  // Game logic
  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = prevSnake[0];
      const dir = directionRef.current;
      let newHead: Position;

      switch (dir) {
        case 'UP':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'DOWN':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'LEFT':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'RIGHT':
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        setGameState('gameover');
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        setGameState('gameover');
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food collision
      setFood(currentFood => {
        if (newHead.x === currentFood.x && newHead.y === currentFood.y) {
          setScore(prev => prev + 10);
          return getRandomPosition(newSnake);
        }
        newSnake.pop();
        return currentFood;
      });

      return newSnake;
    });
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const speed = SPEEDS[difficulty];

    const gameLoop = (timestamp: number) => {
      if (gameStateRef.current !== 'playing') return;

      if (timestamp - lastMoveTimeRef.current >= speed) {
        moveSnake();
        lastMoveTimeRef.current = timestamp;
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, difficulty, moveSnake]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // Prevent default for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
      }

      // Direction changes
      if (gameStateRef.current === 'playing') {
        const current = directionRef.current;
        switch (key) {
          case 'ArrowUp':
          case 'w':
          case 'W':
            if (current !== 'DOWN') setDirection('UP');
            break;
          case 'ArrowDown':
          case 's':
          case 'S':
            if (current !== 'UP') setDirection('DOWN');
            break;
          case 'ArrowLeft':
          case 'a':
          case 'A':
            if (current !== 'RIGHT') setDirection('LEFT');
            break;
          case 'ArrowRight':
          case 'd':
          case 'D':
            if (current !== 'LEFT') setDirection('RIGHT');
            break;
        }
      }

      // Pause/Resume
      if (key === ' ' || key === 'Escape') {
        if (gameStateRef.current === 'playing') {
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
        }
      }

      // Restart
      if (key === 'r' || key === 'R') {
        resetGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    if (gameStateRef.current === 'playing') {
      const current = directionRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && current !== 'LEFT') setDirection('RIGHT');
        else if (dx < 0 && current !== 'RIGHT') setDirection('LEFT');
      } else {
        if (dy > 0 && current !== 'UP') setDirection('DOWN');
        else if (dy < 0 && current !== 'DOWN') setDirection('UP');
      }
    }

    touchStartRef.current = null;
  };

  // D-pad button handler
  const handleDirectionButton = (dir: Direction) => {
    if (gameStateRef.current === 'playing') {
      const current = directionRef.current;
      const opposites: Record<Direction, Direction> = {
        UP: 'DOWN',
        DOWN: 'UP',
        LEFT: 'RIGHT',
        RIGHT: 'LEFT',
      };
      if (dir !== opposites[current]) {
        setDirection(dir);
      }
    }
  };

  // Game controls
  const startGame = () => {
    setSnake(getInitialSnake());
    setFood(getRandomPosition(getInitialSnake()));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
    setGameState('playing');
    lastMoveTimeRef.current = 0;
  };

  const resetGame = () => {
    setSnake(getInitialSnake());
    setFood(getRandomPosition(getInitialSnake()));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
    setGameState('idle');
    lastMoveTimeRef.current = 0;
  };

  const togglePause = () => {
    if (gameState === 'playing') setGameState('paused');
    else if (gameState === 'paused') setGameState('playing');
  };

  // Render grid cell
  const renderCell = (x: number, y: number) => {
    const isSnakeHead = snake[0].x === x && snake[0].y === y;
    const snakeIndex = snake.findIndex(s => s.x === x && s.y === y);
    const isSnake = snakeIndex !== -1;
    const isFood = food.x === x && food.y === y;

    let className = 'w-full h-full rounded-sm transition-all duration-75 ';

    if (isSnakeHead) {
      className += 'bg-emerald-400 shadow-lg shadow-emerald-400/50 scale-110 rounded-md z-10';
    } else if (isSnake) {
      const opacity = Math.max(0.4, 1 - (snakeIndex / snake.length) * 0.6);
      className += `bg-emerald-500 rounded-sm`;
      return (
        <div
          key={`${x}-${y}`}
          className={className}
          style={{ opacity }}
        />
      );
    } else if (isFood) {
      className += 'bg-red-500 shadow-lg shadow-red-500/50 rounded-full animate-pulse scale-90';
    } else {
      className += 'bg-slate-800/30';
    }

    return <div key={`${x}-${y}`} className={className} />;
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-white mb-2 tracking-tight">
          <span className="text-emerald-400">🐍</span> Snake Game
        </h1>

        {/* Score Bar */}
        <div className="flex items-center justify-between bg-slate-800/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-slate-700/50">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Score</div>
              <div className="text-xl font-bold text-emerald-400">{score}</div>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Best</div>
              <div className="text-xl font-bold text-amber-400">{highScore}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Difficulty selector */}
            <div className="flex gap-1">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => {
                    if (gameState === 'idle' || gameState === 'gameover') {
                      setDifficulty(d);
                    }
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    difficulty === d
                      ? `${DIFFICULTY_COLORS[d]} text-white shadow-lg`
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  } ${gameState === 'playing' || gameState === 'paused' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={gameState === 'playing' || gameState === 'paused'}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="relative w-full max-w-lg aspect-square">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
          {/* Grid */}
          <div
            className="w-full h-full p-2 grid gap-px"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
              const x = i % GRID_SIZE;
              const y = Math.floor(i / GRID_SIZE);
              return renderCell(x, y);
            })}
          </div>

          {/* Overlays */}
          {gameState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm">
              <div className="text-6xl mb-4 animate-bounce">🐍</div>
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Play?</h2>
              <p className="text-slate-400 text-sm mb-6 text-center px-4">
                Use arrow keys, WASD, or swipe to control the snake
              </p>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
              >
                Start Game
              </button>
            </div>
          )}

          {gameState === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm">
              <div className="text-5xl mb-4">⏸️</div>
              <h2 className="text-2xl font-bold text-white mb-2">Paused</h2>
              <p className="text-slate-400 text-sm mb-6">Press Space or tap Resume</p>
              <button
                onClick={togglePause}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
              >
                Resume
              </button>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm">
              <div className="text-5xl mb-4">💀</div>
              <h2 className="text-2xl font-bold text-white mb-1">Game Over!</h2>
              <p className="text-3xl font-bold text-emerald-400 mb-1">{score} pts</p>
              {score >= highScore && score > 0 && (
                <p className="text-amber-400 text-sm font-medium mb-4 animate-pulse">🏆 New High Score!</p>
              )}
              {score < highScore && <div className="mb-4"></div>}
              <div className="flex gap-3">
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
                >
                  Play Again
                </button>
                <button
                  onClick={resetGame}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                  Menu
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4">
        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mb-4">
          {gameState === 'playing' && (
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <span>⏸️</span> Pause
            </button>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={resetGame}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <span>🔄</span> Restart
            </button>
          )}
          <button
            onClick={() => setShowControls(!showControls)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all active:scale-95 flex items-center gap-2 md:hidden"
          >
            <span>🎮</span> Controls
          </button>
        </div>

        {/* D-Pad for mobile */}
        <div className={`flex flex-col items-center gap-2 ${showControls ? 'block' : 'hidden md:block'}`}>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('UP'); }}
            onClick={() => handleDirectionButton('UP')}
            className="w-14 h-14 bg-slate-700/80 hover:bg-slate-600 active:bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xl transition-all active:scale-90 shadow-lg border border-slate-600/50"
          >
            ▲
          </button>
          <div className="flex gap-2">
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('LEFT'); }}
              onClick={() => handleDirectionButton('LEFT')}
              className="w-14 h-14 bg-slate-700/80 hover:bg-slate-600 active:bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xl transition-all active:scale-90 shadow-lg border border-slate-600/50"
            >
              ◀
            </button>
            <div className="w-14 h-14 bg-slate-800/50 rounded-xl flex items-center justify-center text-slate-600 border border-slate-700/30">
              ●
            </div>
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('RIGHT'); }}
              onClick={() => handleDirectionButton('RIGHT')}
              className="w-14 h-14 bg-slate-700/80 hover:bg-slate-600 active:bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xl transition-all active:scale-90 shadow-lg border border-slate-600/50"
            >
              ▶
            </button>
          </div>
          <button
            onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('DOWN'); }}
            onClick={() => handleDirectionButton('DOWN')}
            className="w-14 h-14 bg-slate-700/80 hover:bg-slate-600 active:bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xl transition-all active:scale-90 shadow-lg border border-slate-600/50"
          >
            ▼
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="hidden md:flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">↑↓←→</kbd>
            <span>Move</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">Space</kbd>
            <span>Pause</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-400">R</kbd>
            <span>Restart</span>
          </span>
        </div>
      </div>
    </div>
  );
}
