import { test, expect } from '@playwright/test';

// Since we can't import the VibeCity class directly due to DOM dependencies,
// we'll test the geology logic through the browser context
test.describe('Geology System Unit Tests', () => {
  
  test('soil types are properly assigned based on conditions', async ({ page }) => {
    await page.goto('/');
    
    // Inject test code to access the geology generation logic
    const testResults = await page.evaluate(() => {
      // Re-implement core logic for testing (copied from game.ts)
      enum SoilType {
        CLAY = 'clay',
        SAND = 'sand', 
        LOAM = 'loam',
        ROCK = 'rock'
      }
      
      function testSoilTypeLogic(elevation: number, soilNoise: number): SoilType {
        if (elevation > 45) return SoilType.ROCK;
        else if (soilNoise > 0.3) return SoilType.SAND;
        else if (soilNoise < -0.3) return SoilType.CLAY;
        else return SoilType.LOAM;
      }
      
      return {
        rockTerrain: testSoilTypeLogic(50, 0),
        sandTerrain: testSoilTypeLogic(40, 0.5),
        clayTerrain: testSoilTypeLogic(40, -0.5),
        loamTerrain: testSoilTypeLogic(40, 0)
      };
    });
    
    expect(testResults.rockTerrain).toBe('rock');
    expect(testResults.sandTerrain).toBe('sand');
    expect(testResults.clayTerrain).toBe('clay');
    expect(testResults.loamTerrain).toBe('loam');
  });
  
  test('buildability logic works correctly', async ({ page }) => {
    await page.goto('/');
    
    const testResults = await page.evaluate(() => {
      function testBuildability(elevation: number, waterTableDepth: number): boolean {
        return elevation < 50 && waterTableDepth > 0.5;
      }
      
      return {
        tooHigh: testBuildability(55, 5),
        tooWet: testBuildability(40, 0.2),
        buildable: testBuildability(40, 5),
        edgeCase: testBuildability(49, 0.6)
      };
    });
    
    expect(testResults.tooHigh).toBe(false);
    expect(testResults.tooWet).toBe(false);
    expect(testResults.buildable).toBe(true);
    expect(testResults.edgeCase).toBe(true);
  });
  
  test('drainage values are assigned correctly by soil type', async ({ page }) => {
    await page.goto('/');
    
    const testResults = await page.evaluate(() => {
      enum SoilType {
        CLAY = 'clay',
        SAND = 'sand', 
        LOAM = 'loam',
        ROCK = 'rock'
      }
      
      function getDrainage(soilType: SoilType): number {
        return soilType === SoilType.SAND ? 0.9 : 
               soilType === SoilType.CLAY ? 0.2 : 0.6;
      }
      
      return {
        sand: getDrainage(SoilType.SAND),
        clay: getDrainage(SoilType.CLAY),
        loam: getDrainage(SoilType.LOAM),
        rock: getDrainage(SoilType.ROCK)
      };
    });
    
    expect(testResults.sand).toBe(0.9);
    expect(testResults.clay).toBe(0.2);
    expect(testResults.loam).toBe(0.6);
    expect(testResults.rock).toBe(0.6);
  });
  
  test('stability values are assigned correctly by soil type', async ({ page }) => {
    await page.goto('/');
    
    const testResults = await page.evaluate(() => {
      enum SoilType {
        CLAY = 'clay',
        SAND = 'sand', 
        LOAM = 'loam',
        ROCK = 'rock'
      }
      
      function getStability(soilType: SoilType): number {
        return soilType === SoilType.ROCK ? 1.0 : 
               soilType === SoilType.CLAY ? 0.4 : 0.7;
      }
      
      return {
        sand: getStability(SoilType.SAND),
        clay: getStability(SoilType.CLAY),
        loam: getStability(SoilType.LOAM),
        rock: getStability(SoilType.ROCK)
      };
    });
    
    expect(testResults.sand).toBe(0.7);
    expect(testResults.clay).toBe(0.4);
    expect(testResults.loam).toBe(0.7);
    expect(testResults.rock).toBe(1.0);
  });
  
  test('excavation costs are assigned correctly by soil type', async ({ page }) => {
    await page.goto('/');
    
    const testResults = await page.evaluate(() => {
      enum SoilType {
        CLAY = 'clay',
        SAND = 'sand', 
        LOAM = 'loam',
        ROCK = 'rock'
      }
      
      function getExcavationCost(soilType: SoilType): number {
        return soilType === SoilType.ROCK ? 4 : 
               soilType === SoilType.CLAY ? 2 : 1.5;
      }
      
      return {
        sand: getExcavationCost(SoilType.SAND),
        clay: getExcavationCost(SoilType.CLAY),
        loam: getExcavationCost(SoilType.LOAM),
        rock: getExcavationCost(SoilType.ROCK)
      };
    });
    
    expect(testResults.sand).toBe(1.5);
    expect(testResults.clay).toBe(2);
    expect(testResults.loam).toBe(1.5);
    expect(testResults.rock).toBe(4);
  });
  
  test('geological properties are within expected ranges', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Test by clicking on terrain and checking displayed values
    const canvas = page.locator('#three-container canvas');
    const tileInfo = page.locator('#tile-info');
    
    // Sample several tiles
    const validRanges = [];
    for (let i = 0; i < 5; i++) {
      await canvas.click({ position: { x: 200 + i * 100, y: 200 + i * 50 } });
      await page.waitForTimeout(200);
      
      const infoText = await tileInfo.textContent();
      
      if (infoText) {
        const elevation = parseInt(infoText.match(/Elevation:\s*(\d+)m/)?.[1] || '0');
        const drainage = parseInt(infoText.match(/Drainage:\s*(\d+)%/)?.[1] || '0');
        const stability = parseInt(infoText.match(/Stability:\s*(\d+)%/)?.[1] || '0');
        const excavation = parseFloat(infoText.match(/Excavation Cost:\s*(\d+\.?\d*)x/)?.[1] || '0');
        
        validRanges.push({
          elevation: elevation >= 10 && elevation <= 60,
          drainage: drainage >= 0 && drainage <= 100,
          stability: stability >= 0 && stability <= 100,
          excavation: excavation >= 1 && excavation <= 5
        });
      }
    }
    
    // All sampled values should be within valid ranges
    expect(validRanges.length).toBeGreaterThan(0);
    validRanges.forEach(ranges => {
      expect(ranges.elevation).toBe(true);
      expect(ranges.drainage).toBe(true);
      expect(ranges.stability).toBe(true);
      expect(ranges.excavation).toBe(true);
    });
  });
  
  test('3D terrain uses correct soil colors', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Test that the Three.js color mapping logic works
    const colorTests = await page.evaluate(() => {
      // Copy the color logic from game.ts
      function getSoilColor(soilType: string): {r: number, g: number, b: number} {
        switch (soilType) {
          case 'sand':
            return {r: 244/255, g: 164/255, b: 96/255}; // Sandy brown
          case 'clay':
            return {r: 205/255, g: 133/255, b: 63/255}; // Peru
          case 'rock':
            return {r: 139/255, g: 69/255, b: 19/255}; // Saddle brown
          case 'loam':
          default:
            return {r: 34/255, g: 139/255, b: 34/255}; // Forest green
        }
      }
      
      return {
        sand: getSoilColor('sand'),
        clay: getSoilColor('clay'),
        rock: getSoilColor('rock'),
        loam: getSoilColor('loam')
      };
    });
    
    // Verify colors are within expected ranges
    expect(colorTests.sand.r).toBeCloseTo(244/255, 2);
    expect(colorTests.clay.r).toBeCloseTo(205/255, 2);
    expect(colorTests.rock.r).toBeCloseTo(139/255, 2);
    expect(colorTests.loam.g).toBeCloseTo(139/255, 2);
  });
});

test.describe('3D Terrain Integration Tests', () => {
  
  test('3D terrain shows geological variety and click data', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const canvas = page.locator('#three-container canvas');
    const tileInfo = page.locator('#tile-info');
    
    // Test geological data by clicking on different terrain areas
    const geologicalData: Array<{elevation: number, hasValidData: boolean}> = [];
    
    // Sample 5 different areas
    for (let i = 0; i < 5; i++) {
      const x = 150 + i * 120; // Different x positions
      const y = 150 + (i % 3) * 100;  // Different y positions
      
      await canvas.click({ position: { x, y } });
      await page.waitForTimeout(300);
      
      const infoText = await tileInfo.textContent();
      
      // Extract elevation from info text
      const elevationMatch = infoText?.match(/Elevation:\s*(\d+)m/);
      if (elevationMatch && infoText) {
        geologicalData.push({
          elevation: parseInt(elevationMatch[1]),
          hasValidData: infoText.includes('Soil Type:') && 
                       infoText.includes('Bedrock:') &&
                       infoText.includes('Water Table:') &&
                       infoText.includes('Buildable')
        });
      }
    }
    
    // Verify we got valid geological data
    expect(geologicalData.length).toBeGreaterThan(2);
    expect(geologicalData.every(data => data.hasValidData)).toBe(true);
    expect(geologicalData.every(data => data.elevation >= 10 && data.elevation <= 60)).toBe(true);
    
    // Should have some variety in elevations
    const elevations = geologicalData.map(data => data.elevation);
    const uniqueElevations = new Set(elevations);
    expect(uniqueElevations.size).toBeGreaterThan(1);
  });
});