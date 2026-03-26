// ====================================
// WATER DROP GAME - MAIN SCRIPT
// charity: water themed
// ====================================

// === DOM ELEMENT REFERENCES ===
const gameContainer = document.getElementById("game-container");
const scoreDisplay = document.getElementById("score");
const timerDisplay = document.getElementById("time");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const feedbackMessage = document.getElementById("feedback-message");
const gameOverScreen = document.getElementById("game-over-screen");
const gameOverTitle = document.getElementById("game-over-title");
const finalScoreDisplay = document.getElementById("final-score");
const gameMessage = document.getElementById("game-message");
const playAgainBtn = document.getElementById("play-again-btn");
const instructions = document.getElementById("instructions");
const celebration = document.getElementById("celebration");
const comboDisplay = document.getElementById("combo-display");
const milestoneBanner = document.getElementById("milestone-banner");
const difficultySection = document.getElementById("difficulty-section");

// === DIFFICULTY SETTINGS ===
const DIFFICULTY_SETTINGS = {
  easy: {
    timeLimit: 45,
    dropInterval: 1400,   // ms between drops
    dropSpeed: 5.5,        // seconds to fall
    badDropChance: 0.2,
    winScore: 50,
    dropSizeBase: 72,      // larger hitboxes on easy
    label: "Easy"
  },
  normal: {
    timeLimit: 30,
    dropInterval: 1000,
    dropSpeed: 4,
    badDropChance: 0.3,
    winScore: 80,
    dropSizeBase: 64,
    label: "Normal"
  },
  hard: {
    timeLimit: 20,
    dropInterval: 700,
    dropSpeed: 2.5,
    badDropChance: 0.4,
    winScore: 100,
    dropSizeBase: 52,      // smaller on hard
    label: "Hard"
  }
};

let selectedDifficulty = "normal";

// === MILESTONE MESSAGES ===
const MILESTONES = [
  { score: 20,  message: "💧 20 points! You're making a difference!", triggered: false },
  { score: 40,  message: "🌊 40 points! Communities are getting water!", triggered: false },
  { score: 60,  message: "🔥 60 points! You're on fire! Keep going!", triggered: false },
  { score: 80,  message: "⭐ 80 points! Incredible effort!", triggered: false },
  { score: 100, message: "🎉 100 points! You're a water hero!", triggered: false },
  { score: 130, message: "🏆 130 points! Legendary score!", triggered: false }
];

// === GAME STATE VARIABLES ===
let gameRunning = false;
let score = 0;
let timeRemaining = 30;
let dropsCreated = 0;
let dropsCaught = 0;
let dropsCollected = 0;
let gameStartTime = 0;
let milestonesState = [];

let dropMakerInterval;
let timerInterval;

// === WEB AUDIO CONTEXT (for sound effects) ===
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Play a synthesized sound effect
 * @param {"good"|"bad"|"miss"|"win"|"milestone"} type
 */
function playSound(type) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case "good":
        // Bright ascending chime
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(523, now);       // C5
        oscillator.frequency.linearRampToValueAtTime(784, now + 0.15); // G5
        gainNode.gain.setValueAtTime(0.35, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.35);
        oscillator.start(now);
        oscillator.stop(now + 0.35);
        break;

      case "bad":
        // Low thud
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(180, now);
        oscillator.frequency.linearRampToValueAtTime(80, now + 0.25);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;

      case "miss":
        // Soft low tone
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(240, now);
        oscillator.frequency.linearRampToValueAtTime(160, now + 0.4);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.45);
        oscillator.start(now);
        oscillator.stop(now + 0.45);
        break;

      case "win":
        // Victory fanfare - three rising notes
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        const gain3 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc3.connect(gain3); gain3.connect(ctx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(523, now);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        oscillator.start(now); oscillator.stop(now + 0.3);

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(659, now + 0.18);
        gain2.gain.setValueAtTime(0, now + 0.18);
        gain2.gain.linearRampToValueAtTime(0.3, now + 0.2);
        gain2.gain.linearRampToValueAtTime(0, now + 0.5);
        osc2.start(now + 0.18); osc2.stop(now + 0.5);

        osc3.type = "sine";
        osc3.frequency.setValueAtTime(784, now + 0.38);
        gain3.gain.setValueAtTime(0, now + 0.38);
        gain3.gain.linearRampToValueAtTime(0.35, now + 0.4);
        gain3.gain.linearRampToValueAtTime(0, now + 0.85);
        osc3.start(now + 0.38); osc3.stop(now + 0.85);
        break;

      case "milestone":
        // Uplifting two-note ping
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.linearRampToValueAtTime(880, now + 0.2);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.45);
        oscillator.start(now);
        oscillator.stop(now + 0.45);
        break;

      case "click":
        // Soft click for button presses
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(400, now);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
    }
  } catch (e) {
    // Audio not supported - silently ignore
  }
}

// === DIFFICULTY BUTTON HANDLERS ===
document.querySelectorAll(".btn-difficulty").forEach(btn => {
  btn.addEventListener("click", () => {
    if (gameRunning) return;
    document.querySelectorAll(".btn-difficulty").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedDifficulty = btn.dataset.difficulty;
    // Update timer preview
    const settings = DIFFICULTY_SETTINGS[selectedDifficulty];
    timerDisplay.textContent = settings.timeLimit;
    timeRemaining = settings.timeLimit;
    playSound("click");
  });
});

// === EVENT LISTENERS ===
startBtn.addEventListener("click", () => { playSound("click"); startGame(); });
resetBtn.addEventListener("click", () => { playSound("click"); resetGame(); });
playAgainBtn.addEventListener("click", () => { playSound("click"); resetGame(); });

// ====================================
// CORE GAME FUNCTIONS
// ====================================

/**
 * Reset milestone triggers so they fire fresh each game
 */
function resetMilestones() {
  milestonesState = MILESTONES.map(m => ({ ...m, triggered: false }));
}

/**
 * Check if any milestone was just crossed and show it
 */
function checkMilestones(newScore) {
  milestonesState.forEach(milestone => {
    if (!milestone.triggered && newScore >= milestone.score) {
      milestone.triggered = true;
      showMilestoneBanner(milestone.message);
      playSound("milestone");
    }
  });
}

/**
 * Show the milestone banner with a message
 */
function showMilestoneBanner(message) {
  milestoneBanner.textContent = message;
  milestoneBanner.style.display = "block";
  milestoneBanner.classList.remove("milestone-hide");
  milestoneBanner.classList.add("milestone-show");

  clearTimeout(milestoneBanner._hideTimeout);
  milestoneBanner._hideTimeout = setTimeout(() => {
    milestoneBanner.classList.remove("milestone-show");
    milestoneBanner.classList.add("milestone-hide");
    setTimeout(() => {
      milestoneBanner.style.display = "none";
      milestoneBanner.classList.remove("milestone-hide");
    }, 500);
  }, 2800);
}

/**
 * Start the game
 */
function startGame() {
  if (gameRunning) return;

  const settings = DIFFICULTY_SETTINGS[selectedDifficulty];

  gameRunning = true;
  score = 0;
  timeRemaining = settings.timeLimit;
  dropsCreated = 0;
  dropsCaught = 0;
  dropsCollected = 0;
  gameStartTime = Date.now();

  resetMilestones();

  // Update UI
  updateScore();
  updateTimer();
  startBtn.style.display = "none";
  resetBtn.style.display = "inline-block";
  instructions.style.display = "none";
  gameOverScreen.style.display = "none";
  feedbackMessage.className = "feedback-message";
  difficultySection.style.display = "none";

  // Start creating drops at difficulty-based interval
  dropMakerInterval = setInterval(createDrop, settings.dropInterval);

  // Start countdown timer
  timerInterval = setInterval(updateTimer, 100);
}

/**
 * Create a new water drop and add it to the game
 */
function createDrop() {
  if (!gameRunning) return;

  const settings = DIFFICULTY_SETTINGS[selectedDifficulty];

  const drop = document.createElement("div");
  drop.className = "water-drop";

  // Randomly decide if this is a good or bad drop
  const isBadDrop = Math.random() < settings.badDropChance;

  if (isBadDrop) {
    drop.classList.add("bad-drop");
    drop.dataset.type = "bad";
    drop.setAttribute("aria-label", "Contaminated drop - avoid!");
  } else {
    drop.dataset.type = "good";
    drop.setAttribute("aria-label", "Clean water drop - catch it!");
  }

  // Randomize drop size around the base for variety
  // Hitboxes are generously sized (minimum 50px)
  const sizeVariance = Math.random() * 0.5 + 0.75; // 0.75x to 1.25x
  const size = Math.max(50, Math.round(settings.dropSizeBase * sizeVariance));
  drop.style.width = `${size}px`;
  drop.style.height = `${size}px`;

  // Random horizontal position
  const gameWidth = gameContainer.offsetWidth;
  const xPosition = Math.random() * (gameWidth - size);
  drop.style.left = `${xPosition}px`;

  // Fall speed based on difficulty
  const speedVariance = Math.random() * 0.8 + 0.6; // 0.6x to 1.4x
  const duration = settings.dropSpeed * speedVariance;
  drop.style.animationDuration = `${duration}s`;

  dropsCreated++;

  gameContainer.appendChild(drop);

  // Click handler to catch the drop
  drop.addEventListener("click", (e) => catchDrop(e, drop));

  // Touch support for mobile
  drop.addEventListener("touchstart", (e) => {
    e.preventDefault();
    catchDrop(e.touches[0] || e.changedTouches[0], drop);
  }, { passive: false });

  // Remove drop when it reaches the bottom
  drop.addEventListener("animationend", () => {
    if (drop.parentNode) {
      drop.remove();
      penalizeUncaughtDrop(drop);
    }
  });
}

/**
 * Handle catching a drop when user clicks on it
 */
function catchDrop(event, drop) {
  if (event.stopPropagation) event.stopPropagation();
  if (!gameRunning) return;
  // Prevent double-triggering
  if (drop.dataset.caught === "true") return;
  drop.dataset.caught = "true";

  const dropType = drop.dataset.type;
  let pointsGained = 0;

  // Play catch animation
  drop.classList.add("caught");

  if (dropType === "good") {
    pointsGained = 10;
    showFeedback("+10 💧 Clean water caught!", "good");
    dropsCaught++;
    playSound("good");
  } else {
    pointsGained = -5;
    showFeedback("-5 ☣️ Contaminated drop!", "bad");
    playSound("bad");
  }

  score += pointsGained;
  dropsCollected++;

  // Show score popup at drop location
  const rect = drop.getBoundingClientRect();
  showScorePopup(rect.left + rect.width / 2, rect.top, pointsGained);

  // Remove drop from DOM after the caught animation
  setTimeout(() => {
    if (drop.parentNode) {
      drop.remove();
    }
  }, 400);

  updateScore();
  checkMilestones(score);
}

/**
 * Penalize player if a drop reaches the ground without being caught
 */
function penalizeUncaughtDrop(drop) {
  if (!gameRunning) return;
  if (drop.dataset.type === "bad") {
    // Bad drop reached ground - good!
    score += 2;
    showFeedback("☑️ Avoided contamination! +2", "good");
    playSound("good");
  } else {
    // Missed a good drop
    score -= 3;
    showFeedback("💦 Missed a drop! -3", "bad");
    playSound("miss");
  }
  updateScore();
  checkMilestones(score);
}

/**
 * Update game timer and check for game end
 */
function updateTimer() {
  if (!gameRunning) return;

  const settings = DIFFICULTY_SETTINGS[selectedDifficulty];
  const elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
  timeRemaining = Math.max(0, settings.timeLimit - elapsedSeconds);

  timerDisplay.textContent = timeRemaining;

  if (timeRemaining <= 0) {
    endGame();
  }

  // Visual warning when time is low
  if (timeRemaining <= 5) {
    timerDisplay.parentElement.classList.add("warning");
  } else {
    timerDisplay.parentElement.classList.remove("warning");
  }
}

/**
 * Update the score display and check combos
 */
function updateScore() {
  scoreDisplay.textContent = score;

  // Show combo message every 5 drops collected
  if (dropsCollected % 5 === 0 && dropsCollected > 0) {
    comboDisplay.textContent = `🔥 ${dropsCollected} drops collected!`;
    setTimeout(() => {
      comboDisplay.textContent = "";
    }, 1500);
  }
}

/**
 * End the game
 */
function endGame() {
  gameRunning = false;
  clearInterval(dropMakerInterval);
  clearInterval(timerInterval);

  // Remove all remaining drops from the DOM
  const drops = document.querySelectorAll(".water-drop");
  drops.forEach(drop => drop.remove());

  const settings = DIFFICULTY_SETTINGS[selectedDifficulty];
  const WIN_SCORE = settings.winScore;

  let title = "Game Over!";
  let message = "";

  if (score >= WIN_SCORE + 50) {
    title = "🎉 Water Hero! 🎉";
    message = `Amazing! You caught ${dropsCaught} clean water drops and scored ${score} points on ${settings.label} mode! You're helping bring clean water to entire communities! 💪`;
    playSound("win");
    createConfetti();
  } else if (score >= WIN_SCORE) {
    title = "🌟 Mission Accomplished!";
    message = `You hit the ${settings.label} goal of ${WIN_SCORE} points! You caught ${dropsCaught} drops and scored ${score} points. Real impact! 💧`;
    playSound("win");
    createSimpleCelebration();
  } else if (score >= Math.floor(WIN_SCORE * 0.6)) {
    title = "✨ Good Effort!";
    message = `You caught ${dropsCaught} drops and scored ${score} points on ${settings.label} mode. You needed ${WIN_SCORE} to win — so close! Keep going! 🌊`;
  } else if (score >= 0) {
    title = "💪 Keep Trying!";
    message = `You scored ${score} points on ${settings.label} mode. Every attempt counts — try again and bring clean water to more families!`;
  } else {
    title = "🔄 Try Again!";
    message = "You caught some contaminated drops this time, but that's okay! Play again and score higher!";
  }

  gameOverTitle.textContent = title;
  finalScoreDisplay.textContent = `Final Score: ${score}`;
  gameMessage.textContent = message;
  gameOverScreen.style.display = "flex";

  startBtn.style.display = "none";
  resetBtn.style.display = "inline-block";
}

/**
 * Reset the game to initial state
 */
function resetGame() {
  gameRunning = false;

  clearInterval(dropMakerInterval);
  clearInterval(timerInterval);

  score = 0;
  dropsCreated = 0;
  dropsCaught = 0;
  dropsCollected = 0;

  const settings = DIFFICULTY_SETTINGS[selectedDifficulty];
  timeRemaining = settings.timeLimit;

  // Clear all drops from the DOM
  const drops = document.querySelectorAll(".water-drop");
  drops.forEach(drop => drop.remove());

  // Reset UI
  scoreDisplay.textContent = "0";
  timerDisplay.textContent = settings.timeLimit;
  timerDisplay.parentElement.classList.remove("warning");
  comboDisplay.textContent = "";
  gameOverScreen.style.display = "none";
  instructions.style.display = "block";
  celebration.innerHTML = "";
  feedbackMessage.className = "feedback-message";
  milestoneBanner.style.display = "none";
  difficultySection.style.display = "block";

  startBtn.style.display = "inline-block";
  resetBtn.style.display = "none";
}

// ====================================
// FEEDBACK & VISUAL EFFECTS
// ====================================

/**
 * Show feedback message when drop is caught
 */
function showFeedback(message, type) {
  feedbackMessage.textContent = message;
  feedbackMessage.className = `feedback-message ${type} show`;

  setTimeout(() => {
    feedbackMessage.classList.remove("show");
  }, 2500);
}

/**
 * Show score popup near the caught drop
 */
function showScorePopup(x, y, points) {
  const popup = document.createElement("div");
  popup.className = `score-popup ${points > 0 ? "positive" : "negative"}`;
  popup.textContent = points > 0 ? `+${points}` : `${points}`;
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 1000);
}

/**
 * Create confetti celebration effect
 */
function createConfetti() {
  const celebrationEmojis = ["🎉", "🌊", "💧", "✨", "🎊", "💛"];
  celebration.innerHTML = "";

  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement("div");
    confetti.textContent = celebrationEmojis[Math.floor(Math.random() * celebrationEmojis.length)];
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "%";
    confetti.style.top = "-10px";
    confetti.style.fontSize = Math.random() * 20 + 20 + "px";
    confetti.style.animation = `confettiFall ${Math.random() * 2 + 2}s linear forwards`;
    celebration.appendChild(confetti);
  }
}

/**
 * Create simple celebration with emojis
 */
function createSimpleCelebration() {
  const emojis = ["💧", "🌊", "✨", "💛"];
  celebration.innerHTML = emojis.join(" ").repeat(3);
}

// ====================================
// INITIALIZATION
// ====================================

// Set initial timer display from default difficulty
timerDisplay.textContent = DIFFICULTY_SETTINGS[selectedDifficulty].timeLimit;
console.log("Water Drop Game loaded and ready! Click 'Start Game' to begin.");
