// ====================================
// WATER DROP GAME - MAIN SCRIPT
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

// === GAME STATE VARIABLES ===
let gameRunning = false;
let score = 0;
let timeRemaining = 30;
let dropsCreated = 0;
let dropsCaught = 0;
let dropsCollected = 0;
let gameStartTime = 0;

let dropMakerInterval;
let timerInterval;

// === EVENT LISTENERS ===
startBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", resetGame);
playAgainBtn.addEventListener("click", resetGame);

// ====================================
// CORE GAME FUNCTIONS
// ====================================

/**
 * Start the game - called when user clicks Start button
 */
function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning) return;

  gameRunning = true;
  score = 0;
  timeRemaining = 30;
  dropsCreated = 0;
  dropsCaught = 0;
  dropsCollected = 0;
  gameStartTime = Date.now();

  // Update UI
  updateScore();
  updateTimer();
  startBtn.style.display = "none";
  resetBtn.style.display = "inline-block";
  instructions.style.display = "none";
  gameOverScreen.style.display = "none";
  feedbackMessage.className = "feedback-message";

  // Start creating drops every 1 second
  dropMakerInterval = setInterval(createDrop, 1000);

  // Start countdown timer
  timerInterval = setInterval(updateTimer, 100); // Update frequently for smooth countdown
}

/**
 * Create a new water drop and add it to the game
 */
function createDrop() {
  if (!gameRunning) return;

  // Create the drop element
  const drop = document.createElement("div");
  drop.className = "water-drop";
  
  // Randomly decide if this is a good or bad drop (70% good, 30% bad)
  const isBadDrop = Math.random() < 0.3;
  
  if (isBadDrop) {
    drop.classList.add("bad-drop");
    drop.dataset.type = "bad";
  } else {
    drop.dataset.type = "good";
  }

  // Randomize drop size for visual variety
  const initialSize = 60;
  const sizeMultiplier = Math.random() * 0.8 + 0.5; // between 0.5 and 1.3
  const size = initialSize * sizeMultiplier;
  drop.style.width = `${size}px`;
  drop.style.height = `${size}px`;

  // Random horizontal position across the game width
  const gameWidth = gameContainer.offsetWidth;
  const xPosition = Math.random() * (gameWidth - size);
  drop.style.left = `${xPosition}px`;

  // Set animation duration (4 seconds to fall)
  drop.style.animationDuration = "4s";

  dropsCreated++;

  // Add the drop to the game container
  gameContainer.appendChild(drop);

  // Add click handler to catch this drop
  drop.addEventListener("click", (e) => catchDrop(e, drop));

  // Remove drop if it reaches the bottom without being caught
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
  event.stopPropagation(); // Prevent event bubbling
  
  if (!gameRunning) return;

  const dropType = drop.dataset.type;
  let pointsGained = 0;

  // Add animation to drop before removing it
  drop.classList.add("caught");

  // Award or deduct points based on drop type
  if (dropType === "good") {
    pointsGained = 10;
    showFeedback("+10 points! 💧", "good");
    dropsCaught++;
  } else {
    pointsGained = -5;
    showFeedback("-5 points! ❌", "bad");
  }

  score += pointsGained;
  dropsCollected++;

  // Show score popup at drop location
  showScorePopup(event.clientX, event.clientY, pointsGained);

  // Remove drop from DOM after animation
  setTimeout(() => {
    if (drop.parentNode) {
      drop.remove();
    }
  }, 400);

  updateScore();
}

/**
 * Penalize player if a drop reaches the ground without being caught
 */
function penalizeUncaughtDrop(drop) {
  if (drop.dataset.type === "bad") {
    // Bad drop reached ground - this is actually a good thing!
    showFeedback("Avoided bad drop! ✓", "good");
  } else {
    // Good drop reached ground - missed it!
    score -= 3; // Small penalty for missing
    showFeedback("Missed a drop! -3", "bad");
  }
  updateScore();
}

/**
 * Update game timer and check for game end
 */
function updateTimer() {
  if (!gameRunning) return;

  // Calculate remaining time
  const elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
  timeRemaining = Math.max(0, 30 - elapsedSeconds);

  // Update timer display
  timerDisplay.textContent = timeRemaining;

  // End game when time runs out
  if (timeRemaining <= 0) {
    endGame();
  }

  // Visual warning when time is low
  if (timeRemaining <= 5) {
    timerDisplay.classList.add("warning");
  } else {
    timerDisplay.classList.remove("warning");
  }
}

/**
 * Update the score display with combo feedback
 */
function updateScore() {
  scoreDisplay.textContent = score;
  
  // Show combo if we've caught multiple drops
  if (dropsCollected % 5 === 0 && dropsCollected > 0) {
    comboDisplay.textContent = `🔥 ${dropsCollected} drops caught!`;
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

  // Hide drops and show game over screen
  const drops = document.querySelectorAll(".water-drop");
  drops.forEach(drop => drop.remove());

  // Determine performance level with charity: water themed messages
  let title = "Game Over!";
  let message = "";
  
  if (score >= 100) {
    title = "🎉 Excellent Work! 🎉";
    message = `You caught ${dropsCaught} clean water drops! Your score of ${score} points will help provide clean water to families in need. Together, we're making a difference! 💪`;
    createConfetti();
  } else if (score >= 70) {
    title = "🌟 Great Job! ";
    message = `You're making a real impact! You caught ${dropsCaught} clean water drops and scored ${score} points. Let's keep going! 💧`;
    createSimpleCelebration();
  } else if (score >= 40) {
    title = "✨ Good Effort!";
    message = `You caught ${dropsCaught} drops and scored ${score} points! Every drop counts. Keep practicing to improve your score and help more families! 🌊`;
  } else if (score >= 0) {
    title = "💪 Keep Trying!";
    message = `You caught ${dropsCaught} drops and scored ${score} points. Don't give up! Every attempt helps you improve and brings us closer to providing clean water for all.`;
  } else {
    title = "🔄 Try Again!";
    message = "You caught some bad drops this time, but that's okay! The world needs your help. Play again and score higher!";
  }

  // Display game over screen
  gameOverTitle.textContent = title;
  finalScoreDisplay.textContent = `Final Score: ${score}`;
  gameMessage.textContent = message;
  gameOverScreen.style.display = "flex";

  // Show reset button
  startBtn.style.display = "none";
  resetBtn.style.display = "inline-block";
}

/**
 * Reset the game to initial state
 */
function resetGame() {
  gameRunning = false;

  // Stop all intervals
  clearInterval(dropMakerInterval);
  clearInterval(timerInterval);

  // Reset variables
  score = 0;
  timeRemaining = 30;
  dropsCreated = 0;
  dropsCaught = 0;
  dropsCollected = 0;

  // Clear all drops from container
  const drops = document.querySelectorAll(".water-drop");
  drops.forEach(drop => drop.remove());

  // Reset UI
  scoreDisplay.textContent = "0";
  timerDisplay.textContent = "30";
  timerDisplay.classList.remove("warning");
  comboDisplay.textContent = "";
  gameOverScreen.style.display = "none";
  instructions.style.display = "block";
  celebration.innerHTML = "";
  feedbackMessage.className = "feedback-message";

  // Show start button
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
  
  // Remove animation class after it completes
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

  // Remove popup after animation completes
  setTimeout(() => {
    popup.remove();
  }, 1000);
}

/**
 * Create confetti celebration effect when winning
 */
function createConfetti() {
  const celebrationEmojis = ["🎉", "🌊", "💧", "✨", "🎊"];
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
  const emojis = ["💧", "🌊", "✨"];
  celebration.innerHTML = emojis.join(" ").repeat(3);
}

// ====================================
// INITIALIZATION
// ====================================

// Game is ready to start - instructions are shown by default
console.log("Water Drop Game loaded! Click 'Start Game' to begin.");
