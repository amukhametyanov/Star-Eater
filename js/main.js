// js/main.js
import GameScene from './scenes/GameScene.js';

// --- World Dimensions ---
const WORLD_WIDTH = 5000;
const WORLD_HEIGHT = 5000;

// Basic configuration for the Phaser game
const config = {
    type: Phaser.AUTO,
    // Use window dimensions for fullscreen feel
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'body',
    // backgroundColor: '#0a0a2a', // Dark sky color
    physics: {
        default: 'arcade',
        arcade: {
            // Set the larger world bounds for physics calculations
            setBounds: {
                x: 0,
                y: 0,
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT
            },
            // debug: true // Useful for seeing physics bodies and world bounds
            // --- >>> ADD PHYSICS DEBUG SETTINGS HERE <<< ---
            debug: true,            // Master switch to enable debug rendering
            debugShowBody: true,    // Show physics bodies outlines
            debugShowVelocity: true, // Show velocity vectors
            debugBodyColor: 0xff00ff,     // Pink for bodies (easier to see than default)
            debugVelocityColor: 0x00ff00, // Green for velocity vectors
        }
    },
    scene: [
        GameScene
    ],
    // Pass world dimensions to scenes
    sceneConfig: {
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT
    }
};

// Create the Phaser game instance
const game = new Phaser.Game(config);

console.log("Game initialized with large world!");

// Optional: Handle window resize
window.addEventListener('resize', () => {
    // This basic resize might require more sophisticated handling depending on needs
    // For now, it just tells Phaser the new size. Camera might need adjusting.
    game.scale.resize(window.innerWidth, window.innerHeight);
}, false);