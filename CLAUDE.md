# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a 3D vaporwave-themed terrain generation and exploration game called "vibe-city-2". The game features procedurally generated terrain with a retro-futuristic aesthetic.

## Project Status
- Active development with TypeScript-based architecture
- Uses WebGPU for 3D rendering with custom shaders
- Functional programming approach (recently refactored from class-based)
- Includes geological simulation for realistic terrain generation

## Development Commands
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start TypeScript compiler in watch mode and development server
- `npm start` - Build and start development server in background, logs to log/server.log
- `npm run restart` - Kill and restart development server
- `npm test` - Run Playwright tests
- Server runs on http://localhost:3000

## Development Setup
- **Language**: TypeScript with strict configuration
- **Build Tool**: TypeScript compiler (tsc)
- **Testing**: Playwright for end-to-end tests
- **Server**: Custom Node.js HTTP server (server.js)
- **Dependencies**: Minimal - only development dependencies for TypeScript and testing

## Architecture Notes
- **Frontend**: TypeScript compiled to vanilla JavaScript
- **Rendering**: WebGPU with custom compute and render shaders
- **Structure**:
  - `game/src/game.ts` - Main game logic with functional architecture
  - `game/index.html` - Game entry point
  - `game/style.css` - UI styling
  - `game/dist/` - Compiled JavaScript output
  - `server.js` - Development server
  - `tests/` - Playwright test files

## Game Features
- Procedurally generated terrain using Perlin noise
- Geological simulation with tectonic plates and erosion
- Vaporwave aesthetic with gradient colors based on terrain height
- Smooth camera movement with acceleration/deceleration
- WebGPU-based 3D rendering with custom shaders

## Technical Architecture
- Functional programming paradigm (no classes)
- State management through immutable data structures
- WebGPU context for 3D rendering
- Custom compute and render shaders for visual effects
- Terrain generation using multiple noise octaves

## Development Principles
- Use as few dependencies as possible
- Only gitignore what you have to
- Use functional programming
- Maintain type safety with TypeScript's strictest settings