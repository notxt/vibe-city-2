# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a land development game called "vibe-city-2". The repository appears to be in its initial state with only a basic README.md file.

## Project Status
- This is a newly initialized repository with minimal structure
- No package.json or build configuration files are present yet
- No existing development toolchain or framework has been established
- The project appears to be starting from scratch

## Development Commands
- `npm start` - Start development server in background, logs to log/server.log
- `npm run restart` - Restart development server
- Server runs on http://localhost:3000
- `node server.js > server.log 2>&1 &` - Start server in background and pipe logs to file

## Development Setup
- Uses vanilla JavaScript, HTML, and CSS with no external dependencies
- Custom Node.js HTTP server for development (server.js)
- Hot reload requires manual browser refresh

## Architecture Notes
- **Frontend**: Vanilla JavaScript with ES6 classes
- **Server**: Node.js built-in HTTP module
- **Structure**:
  - `index.html` - Main game page
  - `game.js` - Game logic and VibeCity class
  - `style.css` - Game styling
  - `server.js` - Development server

## Game Architecture
- Main game class: `VibeCity` in game.js
- Game board rendered in `#game-board` element
- UI controls in `#ui-panel` element

## Development Principles
- Use as few dependencies as possible
- only gitignore what you have to
- use functional programming