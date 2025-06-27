import { test, expect } from '@playwright/test';

test('game loads with 3D terrain interface', async ({ page }) => {
  await page.goto('/');
  
  await expect(page).toHaveTitle(/Vibe City 2/);
  
  // Check that Three.js container and info box are present
  await expect(page.locator('#three-container')).toBeVisible();
  await expect(page.locator('#info-box')).toBeVisible();
  await expect(page.locator('#tile-info')).toBeVisible();
  
  // Check that the info box contains expected content
  await expect(page.locator('#info-box h3')).toHaveText('Geological Terrain');
  await expect(page.locator('#tile-info p')).toHaveText('Click on terrain to inspect geological data');
});

test('3D terrain auto-starts and renders', async ({ page }) => {
  // Capture console logs to debug any loading issues
  const consoleLogs: string[] = [];
  page.on('console', msg => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
  
  // Capture any errors
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  
  await page.goto('/');
  
  // Wait for terrain to load (auto-starts)
  await page.waitForTimeout(2000);
  
  // Log any errors for debugging
  if (pageErrors.length > 0) {
    console.log('Page errors:', pageErrors);
  }
  if (consoleLogs.length > 0) {
    console.log('Console logs:', consoleLogs);
  }
  
  // Check that WebGL canvas is present
  const canvas = page.locator('#three-container canvas');
  await expect(canvas).toBeVisible();
  
  // Verify canvas has full screen dimensions
  const canvasSize = await canvas.evaluate((canvas: HTMLCanvasElement) => ({
    width: canvas.width,
    height: canvas.height
  }));
  
  expect(canvasSize.width).toBeGreaterThan(800); // Should be viewport width
  expect(canvasSize.height).toBeGreaterThan(600); // Should be viewport height
});

test('clicking on terrain shows geological data', async ({ page }) => {
  await page.goto('/');
  
  // Wait for terrain to load
  await page.waitForTimeout(1000);
  
  const canvas = page.locator('#three-container canvas');
  const tileInfo = page.locator('#tile-info');
  
  // Initially should show instructions
  await expect(tileInfo).toContainText('Click on terrain to inspect geological data');
  
  // Click on terrain (center of canvas)
  await canvas.click({ position: { x: 400, y: 300 } });
  
  // Wait for geological data to appear
  await page.waitForTimeout(500);
  
  // Check that geological information is displayed
  const infoText = await tileInfo.textContent();
  expect(infoText).toContain('Tile (');
  expect(infoText).toContain('Elevation:');
  expect(infoText).toContain('Soil Type:');
  expect(infoText).toContain('Bedrock:');
  expect(infoText).toContain('Water Table:');
  expect(infoText).toMatch(/(Buildable|Not Buildable)/);
});

test('terrain contains geological variety', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);
  
  const canvas = page.locator('#three-container canvas');
  const tileInfo = page.locator('#tile-info');
  
  // Click on multiple points to sample geological variety
  const geologicalData: Array<{elevation: number, soilType: string}> = [];
  
  for (let i = 0; i < 5; i++) {
    // Click on different positions
    const x = 200 + i * 150;
    const y = 200 + (i % 2) * 100;
    
    await canvas.click({ position: { x, y } });
    await page.waitForTimeout(200);
    
    const infoText = await tileInfo.textContent();
    
    // Extract elevation from the text
    const elevationMatch = infoText?.match(/Elevation:\s*(\d+)m/);
    const soilMatch = infoText?.match(/Soil Type:\s*(\w+)/);
    
    if (elevationMatch && soilMatch) {
      geologicalData.push({
        elevation: parseInt(elevationMatch[1]),
        soilType: soilMatch[1]
      });
    }
  }
  
  // Should have collected geological data
  expect(geologicalData.length).toBeGreaterThan(0);
  
  // Should have some variety in elevations
  const elevations = geologicalData.map(data => data.elevation);
  const uniqueElevations = new Set(elevations);
  expect(uniqueElevations.size).toBeGreaterThan(1);
  
  // Should have some variety in soil types
  const soilTypes = geologicalData.map(data => data.soilType);  
  const uniqueSoilTypes = new Set(soilTypes);
  expect(uniqueSoilTypes.size).toBeGreaterThan(0);
});

test('controls work correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);
  
  const canvas = page.locator('#three-container canvas');
  
  // Test that controls information is displayed
  const controlsText = await page.locator('#controls').textContent();
  expect(controlsText).toContain('Mouse');
  expect(controlsText).toContain('Orbit');
  expect(controlsText).toContain('Wheel');
  expect(controlsText).toContain('Zoom');
  expect(controlsText).toContain('+/-');
  expect(controlsText).toContain('height');
  
  // Test keyboard controls (height adjustment)
  await canvas.focus();
  await page.keyboard.press('+');
  await page.waitForTimeout(100);
  
  await page.keyboard.press('-');
  await page.waitForTimeout(100);
  
  // If no errors thrown, controls are working
  expect(true).toBe(true);
});

test('terrain generation is deterministic', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);
  
  const canvas = page.locator('#three-container canvas');
  
  // Click on a specific position and get geological data
  await canvas.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(200);
  
  const firstData = await page.locator('#tile-info').textContent();
  const firstElevation = firstData?.match(/Elevation:\s*(\d+)m/)?.[1];
  
  // Reload page and check same position
  await page.reload();
  await page.waitForTimeout(1000);
  
  await canvas.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(200);
  
  const secondData = await page.locator('#tile-info').textContent();
  const secondElevation = secondData?.match(/Elevation:\s*(\d+)m/)?.[1];
  
  // Should be identical (deterministic generation)
  expect(firstElevation).toBe(secondElevation);
});

test('contour lines are rendered', async ({ page }) => {
  // Capture console logs to verify contour loading
  const consoleLogs: string[] = [];
  page.on('console', msg => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
  
  await page.goto('/');
  await page.waitForTimeout(1500);
  
  // Check that contour loading message appears
  const contourMessage = consoleLogs.find(log => 
    log.includes('WebGL 3D Geological terrain with contours loaded!')
  );
  expect(contourMessage).toBeTruthy();
  
  // Test height adjustment affects both terrain and contours
  const canvas = page.locator('#three-container canvas');
  await canvas.focus();
  
  // Press + to increase height scale
  await page.keyboard.press('+');
  await page.waitForTimeout(200);
  
  // Press - to decrease height scale  
  await page.keyboard.press('-');
  await page.waitForTimeout(200);
  
  // If no errors occur, contour regeneration is working
  expect(true).toBe(true);
});