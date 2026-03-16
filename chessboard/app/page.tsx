"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Chess, Square } from "chess.js";
import { PieceDropHandlerArgs } from "react-chessboard";

import TurnIndicator from "@/components/turnIndicator";
import AEye from "@/components/aEye";
import Board from "@/components/board";

export default function Game() {
  const [thinking, setThinking] = useState(false);
  const [game, setGame] = useState(new Chess());
  const [gameStatus, setGameStatus] = useState<{
    title: string;
    message: string;
    type: "win" | "loss" | "draw";
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkGameOver = useCallback(
    (gameCheck = game) => {
      if (game.in_checkmate()) {
        const winner = game.turn() === "w" ? "Black" : "White";
        const playerWon = winner === "White";
        setGameStatus({
          title: playerWon ? "Victory!" : "Defeat",
          message: playerWon
            ? "You checkmated the bot."
            : "The bot checkmated you.",
          type: playerWon ? "win" : "loss",
        });
      } else if (
        game.in_draw() ||
        game.in_stalemate() ||
        game.in_threefold_repetition() ||
        game.insufficient_material()
      ) {
        setGameStatus({
          title: "Draw",
          message: "The game ended in a draw.",
          type: "draw",
        });
      } else setGameStatus(null);
    },
    [game],
  );

  const makeBotMove = useCallback(async () => {
    if (game.game_over() || thinking) return;

    setThinking(true);

    try {
      const response = await fetch("api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: game.fen(), depth: 7 }),
      });

      const data = await response.json();

      if (data.bestmove) {
        setGame((currentGame) => {
          const gameCopy = new Chess(currentGame.fen());
          const moveResult = gameCopy.move({
            from: data.bestmove.substring(0, 2),
            to: data.bestmove.substring(2, 4),
            promotion: data.bestmove.length > 4 ? data.bestmove[4] : "q",
          });

          if (moveResult) {
            checkGameOver(gameCopy);
            return gameCopy;
          }

          console.error("Engine move rejected:", data.bestmove);
          return currentGame;
        });
      }
    } catch (error) {
      console.error("Engine Communication failed!", error);
    } finally {
      setThinking(false);
    }
  }, [game, thinking, checkGameOver]);

  useEffect(() => {
    const isBlackTurn = game.turn() === "b";

    if (isBlackTurn && !gameStatus && !thinking) {
      console.log("Triggering bot move...");
      makeBotMove();
    }
  }, [game, gameStatus, thinking, makeBotMove]);

  const onDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (thinking || gameStatus || game.turn() !== "w") return false;
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare as Square,
        to: targetSquare as Square,
        promotion: "q",
      });

      if (move === null) return false;

      setGame(gameCopy);
      checkGameOver(gameCopy);
      return true;
    } catch (e) {
      return false;
    }
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGameStatus(null);
    setThinking(false);
  };
  return (
    <main className="flex flex-col items-center px-4">
      <div className="min-h-screen text-slate-100 font-sans">
        <AEye isThinking={thinking} gameStatus={gameStatus?.type} />
        <Board
          game={game}
          onDrop={onDrop}
          thinking={thinking}
          gameStatus={gameStatus}
          resetGame={resetGame}
        />
        <TurnIndicator game={game} />
      </div>
    </main>
  );
}
