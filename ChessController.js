const pieces = {
    r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟",
    R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙",
};

const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

let game = null;
let turnTimer = null;
let globalTimer = null;
let totalSeconds = 0;
let validMovesForSelected = [];

// NEW: Track if a mode has been chosen yet
let modeSelected = false;

function setupBoard() {
    const board = document.getElementById("chessboard");
    board.innerHTML = "";
    for (let i = 0; i < 64; i++) {
        const row = Math.floor(i / 8);
        const col = i % 8;
        const cell = document.createElement("div");
        cell.classList.add("square");
        cell.classList.add((row + col) % 2 === 0 ? "white" : "black");
        cell.dataset.index = i;
        board.appendChild(cell);
    }
}

// FEATURE: Function to handle the date display
function updateCurrentDate() {
    const dateDisplay = document.getElementById("current-date");
    if (!dateDisplay) return;
    const now = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    dateDisplay.textContent = `Date: ${now.toLocaleDateString(undefined, options)}`;
}

function resetGame(mode = "pp", p1 = "White", p2 = "Black") {
    game = {
        board: Array(64).fill(0),
        selected: null,
        turn: 2, // 2 = White, 1 = Black
        mode: mode,
        difficulty: document.getElementById("bot-difficulty").value,
        whiteName: p1,
        blackName: p2,
        isPaused: false,
        status: `${p1} to move`,
        whiteTime: 30,
        blackTime: 30,
    };

    const startLayout = [
        "r", "n", "b", "q", "k", "b", "n", "r",
        "p", "p", "p", "p", "p", "p", "p", "p",
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        "P", "P", "P", "P", "P", "P", "P", "P",
        "R", "N", "B", "Q", "K", "B", "N", "R",
    ];

    game.board = startLayout.map(p => p === 0 ? 0 : p);
    validMovesForSelected = [];
    
    if (turnTimer) clearInterval(turnTimer);
    if (globalTimer) clearInterval(globalTimer);
    
    document.getElementById("chessboard").classList.remove("paused");
    
    const logPanel = document.getElementById("game-log");
    if (logPanel) logPanel.classList.remove("visible");
    
    document.getElementById("log-message").innerHTML = "Fresh game started! White moves first.";

    totalSeconds = 0;
    startGlobalTimer();
    startTurnTimer();
    updateDisplay();
    displayLeaderboard();
}

function startGlobalTimer() {
    const display = document.getElementById("total-game-time");
    globalTimer = setInterval(() => {
        if (game && !game.isPaused) {
            totalSeconds++;
            const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const secs = (totalSeconds % 60).toString().padStart(2, '0');
            display.textContent = `Total Time: ${mins}:${secs}`;
        }
    }, 1000);
}

function startTurnTimer() {
    turnTimer = setInterval(() => {
        if (game && !game.isPaused) {
            if (game.turn === 2) {
                game.whiteTime--;
                if (game.whiteTime <= 0) handleTimeout();
            } else {
                game.blackTime--;
                if (game.blackTime <= 0) handleTimeout();
            }
            updateTimers();
        }
    }, 1000);
}

function handleTimeout() {
    game.whiteTime = 30;
    game.blackTime = 30;
    game.turn = game.turn === 2 ? 1 : 2;
    game.selected = null;
    validMovesForSelected = [];
    explainResult(null, "timeout");
    updateDisplay();
    if (game.mode === "pb" && game.turn === 1) setTimeout(makeBotMove, 500);
}

function explainResult(winner, type) {
    const log = document.getElementById("log-message");
    if (type === "checkmate") {
        log.innerHTML = `<b style="color: #ff4444;">CHECKMATE!</b> ${winner} won because the opponent's King cannot escape attack.`;
    } else if (type === "stalemate") {
        log.innerHTML = `<b style="color: #ffa500;">STALEMATE:</b> It's a draw! No legal moves left, but King is not in check.`;
    } else if (type === "timeout") {
        const activeName = game.turn === 2 ? game.whiteName : game.blackName;
        log.innerHTML = `<b style="color: #3498db;">TIMEOUT:</b> 30s limit reached! Switched turn to ${activeName}.`;
    }
}

function updateTimers() {
    const w = document.querySelector(".white-timer");
    const b = document.querySelector(".black-timer");
    if (w && b) {
        w.textContent = `${game.whiteName}: ${game.whiteTime}s`;
        b.textContent = `${game.blackName}: ${game.blackTime}s`;
        w.classList.toggle("active", game.turn === 2);
        b.classList.toggle("active", game.turn === 1);
    }
}

function togglePause() {
    if (!game || game.status.includes("Wins") || game.status.includes("Draw")) return;
    game.isPaused = !game.isPaused;
    const btn = document.getElementById("pause-game");
    const board = document.getElementById("chessboard");
    
    if (game.isPaused) {
        btn.textContent = "Resume Game";
        btn.classList.add("active");
        board.classList.add("paused");
        document.getElementById("status").textContent = "PAUSED";
    } else {
        btn.textContent = "Pause Game";
        btn.classList.remove("active");
        board.classList.remove("paused");
        document.getElementById("status").textContent = `${game.turn === 2 ? game.whiteName : game.blackName}'s turn`;
    }
}

function getLegalMoves(from) {
    const moves = [];
    const piece = game.board[from];
    if (!piece) return moves;

    for (let to = 0; to < 64; to++) {
        if (isValidMove(from, to)) {
            const target = game.board[to];
            game.board[to] = piece;
            game.board[from] = 0;
            const safe = !isChecked(game.turn);
            game.board[from] = piece;
            game.board[to] = target;
            if (safe) moves.push(to);
        }
    }
    return moves;
}

function isChecked(color) {
    const king = color === 2 ? "K" : "k";
    const kingPos = game.board.indexOf(king);
    if (kingPos === -1) return false;

    const originalTurn = game.turn;
    for (let from = 0; from < 64; from++) {
        const p = game.board[from];
        if (p && (p === p.toLowerCase() ? 1 : 2) !== color) {
            game.turn = (p === p.toLowerCase() ? 1 : 2);
            if (isValidMove(from, kingPos)) {
                game.turn = originalTurn;
                return true;
            }
        }
    }
    game.turn = originalTurn;
    return false;
}

function isValidMove(from, to) {
    const piece = game.board[from];
    const color = piece === piece.toLowerCase() ? 1 : 2;
    if (color !== game.turn) return false;

    const target = game.board[to];
    if (target && (target === target.toLowerCase() ? 1 : 2) === color) return false;

    const [fr, fc] = [Math.floor(from / 8), from % 8];
    const [tr, tc] = [Math.floor(to / 8), to % 8];
    const dr = tr - fr, dc = tc - fc;
    const absDr = Math.abs(dr), absDc = Math.abs(dc);
    const type = piece.toLowerCase();

    if (type === 'p') {
        if (piece === 'P') {
            if (dr === -1 && dc === 0 && !target) return true;
            if (fr === 6 && dr === -2 && dc === 0 && !target && !game.board[from - 8]) return true;
            if (dr === -1 && absDc === 1 && target) return true;
        } else {
            if (dr === 1 && dc === 0 && !target) return true;
            if (fr === 1 && dr === 2 && dc === 0 && !target && !game.board[from + 8]) return true;
            if (dr === 1 && absDc === 1 && target) return true;
        }
        return false;
    }
    if ("rbq".includes(type)) {
        if (!((absDr === 0 || absDc === 0) || (absDr === absDc))) return false;
        if (type === 'r' && absDr !== 0 && absDc !== 0) return false;
        if (type === 'b' && absDr !== absDc) return false;
        const stepR = dr === 0 ? 0 : Math.sign(dr);
        const stepC = dc === 0 ? 0 : Math.sign(dc);
        let r = fr + stepR, c = fc + stepC;
        while (r !== tr || c !== tc) {
            if (game.board[r * 8 + c]) return false;
            r += stepR; c += stepC;
        }
        return true;
    }
    if (type === 'n') return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
    if (type === 'k') return absDr <= 1 && absDc <= 1;
    return false;
}

function makeMove(from, to) {
    const moves = getLegalMoves(from);
    if (!moves.includes(to)) return false;

    game.board[to] = game.board[from];
    game.board[from] = 0;
    
    game.whiteTime = 30;
    game.blackTime = 30;
    game.turn = game.turn === 2 ? 1 : 2;

    const nextColor = game.turn;
    const isCheck = isChecked(nextColor);
    const activeName = nextColor === 2 ? game.whiteName : game.blackName;
    const waitingName = nextColor === 2 ? game.blackName : game.whiteName;
    
    let canMove = false;
    for (let i = 0; i < 64; i++) {
        const p = game.board[i];
        if (p && (p === p.toLowerCase() ? 1 : 2) === nextColor) {
            if (getLegalMoves(i).length > 0) { canMove = true; break; }
        }
    }

    if (!canMove) {
        const winnerName = isCheck ? waitingName : "Draw";
        game.status = isCheck ? `CHECKMATE! ${winnerName} Wins!` : "STALEMATE! It's a Draw.";
        
        const logPanel = document.getElementById("game-log");
        if (logPanel) logPanel.classList.add("visible");

        explainResult(winnerName, isCheck ? "checkmate" : "stalemate");
        clearInterval(turnTimer);
        clearInterval(globalTimer);
        if (winnerName !== "Draw") saveToLeaderboard(winnerName);
    } else {
        game.status = `${activeName}'s turn ${isCheck ? "(CHECK)" : ""}`;
    }

    game.selected = null;
    validMovesForSelected = [];
    updateDisplay();
    if (game.mode === "pb" && game.turn === 1 && canMove) setTimeout(makeBotMove, 600);
    return true;
}

function makeBotMove() {
    if (game.isPaused) return;
    const botPieces = game.board.map((p, i) => ({p, i})).filter(x => x.p && x.p === x.p.toLowerCase());
    let options = [];

    botPieces.forEach(pc => {
        getLegalMoves(pc.i).forEach(to => {
            let score = 0;
            const target = game.board[to];
            if (target) score += pieceValues[target.toLowerCase()] * 10;
            if (game.difficulty === "nightmare" && [27, 28, 35, 36].includes(to)) score += 2;
            options.push({from: pc.i, to, score});
        });
    });

    if (options.length > 0) {
        options.sort((a, b) => b.score - a.score);
        let choice;
        if (game.difficulty === "easy") choice = options[Math.floor(Math.random() * options.length)];
        else if (game.difficulty === "normal") choice = Math.random() > 0.4 ? options[0] : options[Math.floor(Math.random() * options.length)];
        else choice = options[0]; 
        makeMove(choice.from, choice.to);
    } else {
        handleTimeout();
    }
}

function saveToLeaderboard(winner) {
    const timeStr = document.getElementById("total-game-time").textContent.split(": ")[1];
    const newEntry = {
        winner,
        mode: game.mode === "pp" ? "PvP" : "PvBot",
        diff: game.mode === "pb" ? game.difficulty : "-",
        timeValue: totalSeconds,
        timeText: timeStr
    };
    let board = JSON.parse(localStorage.getItem("chess_leaderboard")) || [];
    board.push(newEntry);
    board.sort((a, b) => a.timeValue - b.timeValue);
    localStorage.setItem("chess_leaderboard", JSON.stringify(board.slice(0, 5)));
    displayLeaderboard();
}

function displayLeaderboard() {
    const board = JSON.parse(localStorage.getItem("chess_leaderboard")) || [];
    const body = document.getElementById("leaderboard-body");
    if(body) {
        body.innerHTML = board.map(e => `
            <tr>
                <td>${e.winner}</td>
                <td>${e.mode}</td>
                <td>${e.diff.toUpperCase()}</td>
                <td>${e.timeText}</td>
            </tr>
        `).join("");
    }
}

function updateDisplay() {
    const cells = document.querySelectorAll(".square");
    cells.forEach((cell, i) => {
        const p = game.board[i];
        cell.textContent = p === 0 ? "" : pieces[p];
        cell.classList.remove("selected", "hint", "capture");
        if (game.selected === i) cell.classList.add("selected");
        if (validMovesForSelected.includes(i)) {
            cell.classList.add("hint");
            if (game.board[i] !== 0) cell.classList.add("capture");
        }
    });
    document.getElementById("status").textContent = game.status;
    updateTimers();
}

function init() {
    setupBoard();
    updateCurrentDate(); // INITIALIZE DATE
    
    document.getElementById("chessboard").addEventListener("click", e => {
        const cell = e.target.closest(".square");
        if (!cell || !game || game.isPaused || game.status.includes("Wins") || game.status.includes("Draw")) return;
        const idx = parseInt(cell.dataset.index);

        if (game.selected === null) {
            const p = game.board[idx];
            if (p && (p === p.toLowerCase() ? 1 : 2) === game.turn) {
                game.selected = idx;
                validMovesForSelected = getLegalMoves(idx);
            }
        } else {
            const p = game.board[idx];
            if (p && (p === p.toLowerCase() ? 1 : 2) === game.turn) {
                game.selected = idx;
                validMovesForSelected = getLegalMoves(idx);
            } else {
                makeMove(game.selected, idx);
            }
        }
        updateDisplay();
    });

    document.getElementById("new-game").addEventListener("click", () => {
        if (!modeSelected) {
            alert("Please select Player vs Player or Player vs Bot before starting!");
            return;
        }
        resetGame(game.mode, game.whiteName, game.blackName);
    });

    document.getElementById("mode-pp").addEventListener("click", () => {
        const p1 = prompt("White Name:", "Michael") || "White";
        const p2 = prompt("Black Name:", "Nathan") || "Black";
        modeSelected = true;
        resetGame("pp", p1, p2);
    });

    document.getElementById("mode-pb").addEventListener("click", () => {
        modeSelected = true;
        resetGame("pb", "Player", "Bot");
    });

    document.getElementById("pause-game").addEventListener("click", togglePause);
    document.getElementById("clear-leaderboard").addEventListener("click", () => {
        localStorage.removeItem("chess_leaderboard");
        displayLeaderboard();
    });
    
    document.getElementById("mode-dark").addEventListener("click", function() {
        document.body.classList.toggle("dark-mode");
        this.textContent = document.body.classList.contains("dark-mode") ? "Light Mode" : "Dark Mode";
    });

    document.getElementById("status").textContent = "Select a Mode to Start";
}

init();