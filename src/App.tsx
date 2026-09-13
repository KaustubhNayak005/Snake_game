import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Position = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';
type Difficulty = 'easy' | 'medium' | 'hard';

// Constants
const GRID_SIZE = 20;
const CELL_SIZE_DESKTOP = 24;
const CELL_SIZE_MOBILE = 16;
const SPEEDS: Record<Difficulty, number> = { easy: 150, medium: 100, hard: 60 };
const INITIAL_SNAKE: Position[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

// Helper functions
function getRandomFood(snake: Position[]): Position {
  let food: Position;
  do {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === food.x && seg.y === food.y));
  return food;
}

function getHighScore(difficulty: Difficulty): number {
  const stored = localStorage.getItem(`snake-highscore-${difficulty}`);
  return stored ? parseInt(stored, 10) : 0;
}

function setHighScore(difficulty: Difficulty, score: number): void {
  localStorage.setItem(`snake-highscore-${difficulty}`, score.toString());
}

export default function App() {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>(() => getRandomFood(INITIAL_SNAKE));
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [highScore, setHighScoreState] = useState(() => getHighScore('medium'));
  const [isMobile, setIsMobile] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const foodRef = useRef<Position>(food);

  // Keep food ref in sync
  useEffect(() => { foodRef.current = food; }, [food]);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update high score when difficulty changes
  useEffect(() => {
    setHighScoreState(getHighScore(difficulty));
  }, [difficulty]);

  // Refs for current values in game loop
  const scoreRef = useRef(0);
  const highScoreRef = useRef(getHighScore('medium'));

  // Keep refs in sync
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  // Update high score ref when difficulty changes
  useEffect(() => {
    highScoreRef.current = getHighScore(difficulty);
  }, [difficulty]);

  // Game loop
  const gameLoop = useCallback(() => {
    setSnake(prevSnake => {
      const head = { ...prevSnake[0] };
      const dir = directionRef.current;

      switch (dir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameState('gameover');
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
        setGameState('gameover');
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];
      const ateFood = head.x === foodRef.current.x && head.y === foodRef.current.y;

      if (ateFood) {
        const newScore = scoreRef.current + 10;
        setScore(newScore);
        if (newScore > highScoreRef.current) {
          setHighScore(difficulty, newScore);
          setHighScoreState(newScore);
          highScoreRef.current = newScore;
        }
        setFood(getRandomFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [difficulty]);

  // Start/stop game loop
  useEffect(() => {
    if (gameState === 'playing') {
      const interval = setInterval(gameLoop, SPEEDS[difficulty]);
      gameLoopRef.current = interval as unknown as number;
      return () => clearInterval(interval);
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
  }, [gameState, gameLoop, difficulty]);

  // Handle direction change
  const changeDirection = useCallback((newDir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
    };
    if (opposites[newDir] !== directionRef.current) {
      directionRef.current = newDir;
      setDirection(newDir);
    }
  }, []);

  // (keyboard handler moved below after function definitions)

  // Touch controls (swipe)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      changeDirection(dy > 0 ? 'DOWN' : 'UP');
    }
    touchStartRef.current = null;
  }, [changeDirection]);

  // Game actions
  const startGame = useCallback(() => {
    const initialFood = getRandomFood(INITIAL_SNAKE);
    setSnake(INITIAL_SNAKE);
    setFood(initialFood);
    foodRef.current = initialFood;
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
    scoreRef.current = 0;
    setHighScoreState(getHighScore(difficulty));
    highScoreRef.current = getHighScore(difficulty);
    setGameState('playing');
  }, [difficulty]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') setGameState('paused');
    else if (gameState === 'paused') setGameState('playing');
  }, [gameState]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'idle' || gameState === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
          return;
        }
      }

      if (gameState === 'playing') {
        switch (e.key) {
          case 'ArrowUp': case 'w': case 'W':
            e.preventDefault(); changeDirection('UP'); break;
          case 'ArrowDown': case 's': case 'S':
            e.preventDefault(); changeDirection('DOWN'); break;
          case 'ArrowLeft': case 'a': case 'A':
            e.preventDefault(); changeDirection('LEFT'); break;
          case 'ArrowRight': case 'd': case 'D':
            e.preventDefault(); changeDirection('RIGHT'); break;
          case ' ': case 'Escape':
            e.preventDefault();
            setGameState('paused');
            break;
        }
      } else if (gameState === 'paused') {
        if (e.key === ' ' || e.key === 'Escape') {
          e.preventDefault();
          setGameState('playing');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, changeDirection, startGame, togglePause]);

  const cellSize = isMobile ? CELL_SIZE_MOBILE : CELL_SIZE_DESKTOP;
  const boardSize = GRID_SIZE * cellSize;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col items-center justify-center p-4 select-none overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
          🐍 Snake Game
        </h1>

        {/* Score Bar */}
        <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur rounded-xl px-4 py-2 border border-slate-700">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Score</div>
            <div className="text-xl font-bold text-green-400 tabular-nums">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Best</div>
            <div className="text-xl font-bold text-yellow-400 tabular-nums">{highScore}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Length</div>
            <div className="text-xl font-bold text-blue-400 tabular-nums">{snake.length}</div>
          </div>
        </div>
      </div>

      {/* Difficulty Selector */}
      <div className="flex gap-2 mb-4">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
          <button
            key={d}
            onClick={() => {
              if (gameState !== 'playing') {
                setDifficulty(d);
                setHighScoreState(getHighScore(d));
              }
            }}
            disabled={gameState === 'playing'}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              difficulty === d
                ? d === 'easy'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-lg shadow-green-500/10'
                  : d === 'medium'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-500/10'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg shadow-red-500/10'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
            } ${gameState === 'playing' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {/* Game Board */}
      <div
        ref={boardRef}
        className="relative rounded-xl overflow-hidden shadow-2xl shadow-black/50 border-2 border-slate-700"
        style={{ width: boardSize, height: boardSize }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grid Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: `${cellSize}px ${cellSize}px`,
            backgroundColor: '#0f172a',
          }}
        />

        {/* Food */}
        <div
          className="absolute rounded-full transition-all duration-200 animate-pulse"
          style={{
            width: cellSize - 4,
            height: cellSize - 4,
            left: food.x * cellSize + 2,
            top: food.y * cellSize + 2,
            background: 'radial-gradient(circle, #ef4444, #dc2626)',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.3)',
          }}
        />

        {/* Snake */}
        {snake.map((segment, index) => {
          const isHead = index === 0;
          const opacity = 1 - (index / snake.length) * 0.4;
          return (
            <div
              key={`${index}-${segment.x}-${segment.y}`}
              className="absolute transition-all duration-75"
              style={{
                width: cellSize - 2,
                height: cellSize - 2,
                left: segment.x * cellSize + 1,
                top: segment.y * cellSize + 1,
                borderRadius: isHead ? '6px' : '4px',
                background: isHead
                  ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                  : `rgba(34, 197, 94, ${opacity})`,
                boxShadow: isHead
                  ? '0 0 8px rgba(74, 222, 128, 0.5), inset 0 1px 2px rgba(255,255,255,0.2)'
                  : 'inset 0 1px 1px rgba(255,255,255,0.1)',
                zIndex: snake.length - index,
              }}
            >
              {/* Snake eyes on head */}
              {isHead && (
                <>
                  <div
                    className="absolute bg-white rounded-full"
                    style={{
                      width: cellSize * 0.2,
                      height: cellSize * 0.2,
                      ...getEyePosition(direction, cellSize, 'left'),
                    }}
                  >
                    <div
                      className="absolute bg-slate-900 rounded-full"
                      style={{
                        width: '60%',
                        height: '60%',
                        top: '20%',
                        left: '20%',
                      }}
                    />
                  </div>
                  <div
                    className="absolute bg-white rounded-full"
                    style={{
                      width: cellSize * 0.2,
                      height: cellSize * 0.2,
                      ...getEyePosition(direction, cellSize, 'right'),
                    }}
                  >
                    <div
                      className="absolute bg-slate-900 rounded-full"
                      style={{
                        width: '60%',
                        height: '60%',
                        top: '20%',
                        left: '20%',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Overlay States */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-fadeIn">
            <div className="text-5xl mb-4">🐍</div>
            <p className="text-white text-lg font-medium mb-2">Ready to Play?</p>
            <p className="text-slate-400 text-sm mb-4">
              {isMobile ? 'Swipe or use buttons to control' : 'Use Arrow keys or WASD'}
            </p>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200"
            >
              Start Game
            </button>
            <p className="text-slate-500 text-xs mt-3">or press Enter / Space</p>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-fadeIn">
            <div className="text-4xl mb-3">⏸️</div>
            <p className="text-white text-xl font-bold mb-4">Paused</p>
            <button
              onClick={togglePause}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200"
            >
              Resume
            </button>
            <p className="text-slate-500 text-xs mt-3">or press Space / Esc</p>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-fadeIn">
            <div className="text-4xl mb-3">💀</div>
            <p className="text-red-400 text-xl font-bold mb-1">Game Over!</p>
            <p className="text-white text-2xl font-bold mb-1">Score: {score}</p>
            {score >= highScore && score > 0 && (
              <p className="text-yellow-400 text-sm font-medium mb-2 animate-bounce">🏆 New High Score!</p>
            )}
            <button
              onClick={startGame}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200 mt-2"
            >
              Play Again
            </button>
            <p className="text-slate-500 text-xs mt-3">or press Enter / Space</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 flex gap-3">
        {gameState === 'playing' && (
          <button
            onClick={togglePause}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all duration-200 border border-slate-600 hover:border-slate-500"
          >
            ⏸ Pause
          </button>
        )}
        {(gameState === 'playing' || gameState === 'paused') && (
          <button
            onClick={startGame}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all duration-200 border border-slate-600 hover:border-slate-500"
          >
            🔄 Restart
          </button>
        )}
      </div>

      {/* Mobile D-Pad Controls */}
      {isMobile && gameState === 'playing' && (
        <div className="mt-6 grid grid-cols-3 gap-2 w-40">
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); changeDirection('UP'); }}
            className="aspect-square bg-slate-700/80 hover:bg-slate-600 active:bg-green-600 rounded-xl flex items-center justify-center text-2xl text-white border border-slate-600 transition-all duration-100 active:scale-95"
          >
            ↑
          </button>
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
            className="aspect-square bg-slate-700/80 hover:bg-slate-600 active:bg-green-600 rounded-xl flex items-center justify-center text-2xl text-white border border-slate-600 transition-all duration-100 active:scale-95"
          >
            ←
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); togglePause(); }}
            className="aspect-square bg-slate-700/80 hover:bg-slate-600 active:bg-blue-600 rounded-xl flex items-center justify-center text-lg text-white border border-slate-600 transition-all duration-100 active:scale-95"
          >
            ⏸
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
            className="aspect-square bg-slate-700/80 hover:bg-slate-600 active:bg-green-600 rounded-xl flex items-center justify-center text-2xl text-white border border-slate-600 transition-all duration-100 active:scale-95"
          >
            →
          </button>
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
            className="aspect-square bg-slate-700/80 hover:bg-slate-600 active:bg-green-600 rounded-xl flex items-center justify-center text-2xl text-white border border-slate-600 transition-all duration-100 active:scale-95"
          >
            ↓
          </button>
          <div />
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 text-center text-slate-500 text-xs max-w-sm">
        {!isMobile && (
          <p>Arrow keys / WASD to move • Space to pause • Enter to start</p>
        )}
        {isMobile && gameState !== 'playing' && (
          <p>Swipe on the board or use the D-pad to control the snake</p>
        )}
      </div>
    </div>
  );
}

// Helper to position snake eyes based on direction
function getEyePosition(direction: Direction, cellSize: number, side: 'left' | 'right'): React.CSSProperties {
  const offset = cellSize * 0.15;

  switch (direction) {
    case 'UP':
      return side === 'left'
        ? { top: offset, left: offset }
        : { top: offset, right: offset };
    case 'DOWN':
      return side === 'left'
        ? { bottom: offset, left: offset }
        : { bottom: offset, right: offset };
    case 'LEFT':
      return side === 'left'
        ? { top: offset, left: offset }
        : { bottom: offset, left: offset };
    case 'RIGHT':
      return side === 'left'
        ? { top: offset, right: offset }
        : { bottom: offset, right: offset };
  }
}
