// Types and Interfaces
enum SoilType {
    CLAY = 'clay',
    SAND = 'sand', 
    LOAM = 'loam',
    ROCK = 'rock'
}

enum BedrockType {
    GRANITE = 'granite',
    LIMESTONE = 'limestone',
    SANDSTONE = 'sandstone',
    SHALE = 'shale'
}

enum ResourceType {
    // Water sources
    SPRING = 'spring',
    RIVER = 'river',
    SEASONAL_STREAM = 'seasonal_stream',
    
    // Food sources
    BERRIES = 'berries',
    NUTS = 'nuts',
    EDIBLE_PLANTS = 'edible_plants',
    GAME_TRAIL = 'game_trail',
    
    // Materials
    FLINT = 'flint',
    OBSIDIAN = 'obsidian',
    CLAY_DEPOSIT = 'clay_deposit',
    HARDWOOD = 'hardwood',
    SOFTWOOD = 'softwood',
    
    // Shelter
    CAVE = 'cave',
    ROCK_SHELTER = 'rock_shelter'
}

interface Resource {
    type: ResourceType;
    abundance: number; // 0-1 (0 = scarce, 1 = abundant)
    seasonal: boolean; // Does this resource vary by season?
    accessibility: number; // 0-1 (0 = hard to access, 1 = easy)
}

interface GeologyData {
    elevation: number;        // 0-100 (meters above sea level)
    soilType: SoilType;
    soilDepth: number;        // 0-10 meters
    bedrockType: BedrockType;
    waterTableDepth: number;  // 0-20 meters (0 = surface water)
    drainage: number;         // 0-1 (0 = poor, 1 = excellent)
    stability: number;        // 0-1 (0 = unstable, 1 = very stable)
    excavationCost: number;   // 1-5 multiplier for digging
}

interface TerrainTile {
    x: number;
    y: number;
    geology: GeologyData;
    buildable: boolean;
    resources: Resource[];
    building?: any; // Will define building types later
}

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

interface Matrix4 {
    elements: Float32Array;
}

// Game State Interface
interface GameState {
    // Canvas and WebGPU
    canvas: HTMLCanvasElement;
    adapter: GPUAdapter;
    device: GPUDevice;
    context: GPUCanvasContext;
    format: GPUTextureFormat
    
    // Terrain
    terrain: TerrainTile[][];
    heightmap: number[][];
    mapSize: number;
    heightScale: number;
    waterLevel: number;
    showWater: boolean;
    
    // Sun
    sun: {
        position: Vector3;
        color: Vector3;
        intensity: number;
    };
    
    // Camera
    camera: {
        position: Vector3;
        target: Vector3;
        distance: number;
        velocity: Vector3;
        acceleration: number;
        maxSpeed: number;
        damping: number;
    };
    
    // Simulation
    simulation: {
        step: number;
        maxSteps: number;
        speed: number;
        lastTime: number;
        isActive: boolean;
    };
    
    // Rendering Pipelines
    pipelines: {
        terrain: GPURenderPipeline | null;
        lines: GPURenderPipeline | null;
    };
    
    // GPU Buffers
    buffers: {
        vertex: GPUBuffer | null;
        index: GPUBuffer | null;
        color: GPUBuffer | null;
        contourVertex: GPUBuffer | null;
        contourColor: GPUBuffer | null;
        waterVertex: GPUBuffer | null;
        waterIndex: GPUBuffer | null;
        waterColor: GPUBuffer | null;
        uniform: GPUBuffer | null;
    };
    
    // Bind Groups
    bindGroups: {
        terrain: GPUBindGroup | null;
        lines: GPUBindGroup | null;
    };
    
    // UI Elements
    elements: {
        container: HTMLElement | null;
        tileInfo: HTMLElement | null;
        fpsCounter: HTMLElement | null;
    };
    
    // Input
    keysPressed: Set<string>;
    
    // Performance
    fps: {
        current: number;
        frameCount: number;
        totalFrames: number;
        lastTime: number;
    };
}

// Utility Functions
const pipe = <T>(...fns: Array<(arg: T) => T>) => (value: T): T =>
    fns.reduce((acc, fn) => fn(acc), value);

// compose is available for future use
// const compose = <T>(...fns: Array<(arg: T) => T>) => (value: T): T =>
//     fns.reduceRight((acc, fn) => fn(acc), value);

// Vector Math Functions (Pure)
const normalize = (v: Vector3): Vector3 => {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return {
        x: v.x / length,
        y: v.y / length,
        z: v.z / length
    };
};

const cross = (a: Vector3, b: Vector3): Vector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
});

const dot = (a: Vector3, b: Vector3): number => 
    a.x * b.x + a.y * b.y + a.z * b.z;

// Old WebGL functions removed - now using WebGPU

// WGSL Shader Sources
const getTerrainShader = () => `
struct Uniforms {
    modelViewMatrix: mat4x4<f32>,
    projectionMatrix: mat4x4<f32>,
    sunPosition: vec3<f32>,
    sunColor: vec3<f32>,
    sunIntensity: f32,
    _padding: vec3<f32> // Align to 16 bytes
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) worldPosition: vec3<f32>
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(input.position, 1.0);
    output.position = uniforms.projectionMatrix * mvPosition;
    output.color = input.color;
    output.worldPosition = input.position;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate surface normal using screen-space derivatives
    let dFdxPos = dpdx(input.worldPosition);
    let dFdyPos = dpdy(input.worldPosition);
    let normal = normalize(cross(dFdxPos, dFdyPos));
    
    // Sun lighting configuration
    let sunPosition = uniforms.sunPosition;
    let sunDirection = normalize(sunPosition - input.worldPosition);
    let sunColor = uniforms.sunColor;
    let sunIntensity = uniforms.sunIntensity;
    
    // Reduced ambient lighting for dramatic shadows
    let ambient = vec3<f32>(0.3, 0.4, 0.5) * 0.2;
    
    // Dramatic diffuse lighting with much brighter highlights
    let diffuseFactor = max(0.05, dot(normal, sunDirection)); // Allow much darker shadows
    let diffuse = sunColor * diffuseFactor * sunIntensity * 1.5; // Much brighter highlights
    
    // Enhanced rim lighting for brilliant peak highlights
    let viewDirection = normalize(vec3<f32>(0.0, 1.0, -1.0)); // Camera direction
    let rimFactor = 1.0 - max(0.0, dot(normal, viewDirection));
    let rimLight = vec3<f32>(1.2, 0.4, 1.2) * pow(rimFactor, 2.5) * 0.4; // Brighter rim
    
    // Combine lighting
    let lighting = ambient + diffuse + rimLight;
    
    // Apply to vertex colors with brightness boost
    let finalColor = input.color * lighting * 1.8;
    
    // Only underwater areas (blue=1.0) get transparency
    let isWater = input.color.b > 0.9;
    let alpha = select(1.0, 0.7, isWater);
    
    return vec4<f32>(finalColor, alpha);
}
`;

const getLineShader = () => `
struct Uniforms {
    modelViewMatrix: mat4x4<f32>,
    projectionMatrix: mat4x4<f32>
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let mvPosition = uniforms.modelViewMatrix * vec4<f32>(input.position, 1.0);
    output.position = uniforms.projectionMatrix * mvPosition;
    output.color = input.color;
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.color, 1.0);
}
`;

// WebGPU Initialization Functions
const initWebGPU = async (): Promise<{
    adapter: GPUAdapter;
    device: GPUDevice;
    context: GPUCanvasContext;
    format: GPUTextureFormat;
    canvas: HTMLCanvasElement;
}> => {
    // Check for WebGPU support
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported in this browser');
    }
    
    // Request adapter
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('No appropriate GPUAdapter found');
    }
    
    // Request device
    const device = await adapter.requestDevice();
    
    // Create canvas and get WebGPU context
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.tabIndex = 0;
    
    const context = canvas.getContext('webgpu');
    if (!context) {
        throw new Error('Could not get WebGPU context');
    }
    
    // Get preferred format
    const format = navigator.gpu.getPreferredCanvasFormat();
    
    // Configure the context
    context.configure({
        device,
        format,
        alphaMode: 'opaque'
    });
    
    return { adapter, device, context, format, canvas };
};

// State Creation Functions
const createInitialState = async (): Promise<GameState> => {
    const container = document.getElementById('three-container');
    const tileInfo = document.getElementById('tile-info');
    const fpsCounter = document.getElementById('fps-counter');
    
    // Initialize WebGPU
    const { adapter, device, context, format, canvas } = await initWebGPU();
    
    if (container) {
        container.appendChild(canvas);
    }
    
    return {
        canvas,
        adapter,
        device,
        context,
        format,
        terrain: [],
        heightmap: [],
        mapSize: 50,
        heightScale: 2.0,
        waterLevel: 35,
        showWater: true,
        sun: {
            position: { x: 100, y: 150, z: 50 },
            color: { x: 1.0, y: 0.95, z: 0.8 }, // Warm sunlight
            intensity: 12.0
        },
        camera: {
            position: { x: 0, y: 120, z: 40 },
            target: { x: 0, y: 80, z: 0 },
            distance: 50,
            velocity: { x: 0, y: 0, z: 0 },
            acceleration: 0.15,
            maxSpeed: 1.5,
            damping: 0.85
        },
        simulation: {
            step: 0,
            maxSteps: 50,
            speed: 200,
            lastTime: 0,
            isActive: true
        },
        pipelines: {
            terrain: null,
            lines: null
        },
        buffers: {
            vertex: null,
            index: null,
            color: null,
            contourVertex: null,
            contourColor: null,
            waterVertex: null,
            waterIndex: null,
            waterColor: null,
            uniform: null
        },
        bindGroups: {
            terrain: null,
            lines: null
        },
        elements: {
            container,
            tileInfo,
            fpsCounter
        },
        keysPressed: new Set<string>(),
        fps: {
            current: 0,
            frameCount: 0,
            totalFrames: 0,
            lastTime: 0
        }
    };
};

// WebGPU Setup Functions
const createRenderPipelines = (state: GameState): GameState => {
    const { device, format } = state;
    
    // Create uniform buffer for matrices and sun data
    const uniformBuffer = device.createBuffer({
        size: 320, // 2 * 64 bytes for matrices + 64 bytes for sun data + padding
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Create bind group layout for uniforms
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
        }]
    });
    
    // Create terrain render pipeline
    const terrainModule = device.createShaderModule({
        code: getTerrainShader()
    });
    
    console.log('Terrain shader module created successfully');
    
    const terrainPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        }),
        vertex: {
            module: terrainModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 6 * 4, // 3 floats for position + 3 floats for color
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3' // position
                    },
                    {
                        shaderLocation: 1,
                        offset: 3 * 4,
                        format: 'float32x3' // color
                    }
                ]
            }]
        },
        fragment: {
            module: terrainModule,
            entryPoint: 'fs_main',
            targets: [{
                format,
                // No blending for maximum brightness
            }]
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'none'
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        }
    });
    
    console.log('Terrain pipeline created successfully');
    
    // Create line render pipeline
    const lineModule = device.createShaderModule({
        code: getLineShader()
    });
    
    const linePipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        }),
        vertex: {
            module: lineModule,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 6 * 4, // 3 floats for position + 3 floats for color
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3' // position
                    },
                    {
                        shaderLocation: 1,
                        offset: 3 * 4,
                        format: 'float32x3' // color
                    }
                ]
            }]
        },
        fragment: {
            module: lineModule,
            entryPoint: 'fs_main',
            targets: [{
                format
            }]
        },
        primitive: {
            topology: 'line-list'
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        }
    });
    
    // Create bind groups
    const terrainBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }]
    });
    
    const linesBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }]
    });
    
    return {
        ...state,
        pipelines: {
            terrain: terrainPipeline,
            lines: linePipeline
        },
        buffers: {
            ...state.buffers,
            uniform: uniformBuffer
        },
        bindGroups: {
            terrain: terrainBindGroup,
            lines: linesBindGroup
        }
    };
};

// Terrain Generation Functions (Pure)
const createHeightmap = (size: number): number[][] => {
    const heightmap: number[][] = [];
    
    for (let y = 0; y < size; y++) {
        heightmap[y] = [];
        for (let x = 0; x < size; x++) {
            // Start with relatively flat terrain at sea level
            const noise = (Math.random() - 0.5) * 8;
            heightmap[y]![x] = 35 + noise;
        }
    }
    
    return heightmap;
};

const applyTectonicUplift = (heightmap: number[][], mapSize: number, intensity: number): number[][] => {
    const result = heightmap.map(row => [...row]);
    
    // Create scattered hill centers with higher peaks for magenta colors
    const hillCenters = [
        { x: 12, y: 15, strength: 1.2 },
        { x: 35, y: 8, strength: 1.0 },
        { x: 28, y: 25, strength: 1.1 },
        { x: 8, y: 35, strength: 0.8 },
        { x: 42, y: 32, strength: 1.0 },
        { x: 20, y: 40, strength: 0.7 },
        { x: 38, y: 18, strength: 0.9 },
        { x: 15, y: 28, strength: 0.6 },
    ];
    
    for (let y = 2; y < mapSize - 2; y++) {
        for (let x = 2; x < mapSize - 2; x++) {
            let totalUplift = 0;
            
            for (const hill of hillCenters) {
                const distance = Math.sqrt((x - hill.x) ** 2 + (y - hill.y) ** 2);
                const maxRadius = 15;
                
                if (distance < maxRadius) {
                    const falloff = Math.exp(-(distance * distance) / (2 * (maxRadius / 3) ** 2));
                    totalUplift += hill.strength * falloff * intensity * 0.5;
                }
            }
            
            const noise = (Math.random() - 0.5) * intensity * 0.05;
            result[y]![x]! += totalUplift + noise;
        }
    }
    
    return result;
};

const applyHydraulicErosion = (heightmap: number[][], mapSize: number): number[][] => {
    const result = heightmap.map(row => [...row]);
    const erosionRate = 0.4;
    const sedimentCapacity = 2.0;
    
    for (let drop = 0; drop < mapSize * 2; drop++) {
        let x = Math.floor(Math.random() * mapSize);
        let y = Math.floor(Math.random() * mapSize);
        let sediment = 0;
        
        for (let step = 0; step < 30; step++) {
            if (x <= 2 || x >= mapSize - 3 || y <= 2 || y >= mapSize - 3) break;
            
            let steepestGradient = 0;
            let nextX = x, nextY = y;
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < mapSize && ny >= 0 && ny < mapSize) {
                        const gradient = result[y]![x]! - result[ny]![nx]!;
                        if (gradient > steepestGradient) {
                            steepestGradient = gradient;
                            nextX = nx;
                            nextY = ny;
                        }
                    }
                }
            }
            
            if (steepestGradient <= 0) {
                result[y]![x]! += sediment;
                break;
            }
            
            const erosion = Math.min(steepestGradient * erosionRate, 1.0);
            result[y]![x]! -= erosion;
            sediment += erosion;
            
            if (sediment > sedimentCapacity) {
                const deposit = sediment - sedimentCapacity;
                result[y]![x]! += deposit;
                sediment = sedimentCapacity;
            }
            
            x = nextX;
            y = nextY;
        }
    }
    
    return result;
};

const applyThermalErosion = (heightmap: number[][], mapSize: number): number[][] => {
    const result = heightmap.map(row => [...row]);
    const maxSlope = 0.5;
    const erosionRate = 0.05;
    
    for (let y = 2; y < mapSize - 2; y++) {
        for (let x = 2; x < mapSize - 2; x++) {
            const currentHeight = result[y]![x]!;
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const nx = x + dx;
                    const ny = y + dy;
                    const neighborHeight = result[ny]![nx]!;
                    
                    const heightDiff = currentHeight - neighborHeight;
                    if (heightDiff > maxSlope) {
                        const transfer = (heightDiff - maxSlope) * erosionRate;
                        result[y]![x]! -= transfer;
                        result[ny]![nx]! += transfer;
                    }
                }
            }
        }
    }
    
    return result;
};

const smoothEdges = (heightmap: number[][], mapSize: number): number[][] => {
    const result = heightmap.map(row => [...row]);
    
    for (let i = 0; i < 2; i++) {
        for (let x = 0; x < mapSize; x++) {
            result[i]![x] = result[2]![x]!;
            result[mapSize - 1 - i]![x] = result[mapSize - 3]![x]!;
        }
        
        for (let y = 0; y < mapSize; y++) {
            result[y]![i] = result[y]![2]!;
            result[y]![mapSize - 1 - i] = result[y]![mapSize - 3]!;
        }
    }
    
    return result;
};

// River Generation Functions (Pure)
const generateRivers = (terrain: TerrainTile[][], mapSize: number): TerrainTile[][] => {
    const updatedTerrain = terrain.map(row => row.map(tile => ({ ...tile, resources: [...tile.resources] })));
    
    // Find high elevation starting points for rivers
    const riverSources: Array<{x: number, y: number, elevation: number}> = [];
    
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const tile = terrain[y]![x]!;
            // Rivers start from high elevation areas with springs or high water table
            if (tile.geology.elevation > 60 && 
                (tile.geology.waterTableDepth < 2.0 || 
                 tile.resources.some(r => r.type === ResourceType.SPRING))) {
                riverSources.push({x, y, elevation: tile.geology.elevation});
            }
        }
    }
    
    // Generate river paths from each source
    for (const source of riverSources) {
        let currentX = source.x;
        let currentY = source.y;
        let currentElevation = source.elevation;
        const visited = new Set<string>();
        
        // Follow steepest descent to create river path
        while (true) {
            const key = `${currentX},${currentY}`;
            if (visited.has(key)) break;
            visited.add(key);
            
            // Add river resource to current tile if not already present
            const currentTile = updatedTerrain[currentY]![currentX]!;
            if (!currentTile.resources.some(r => r.type === ResourceType.RIVER)) {
                currentTile.resources.push({
                    type: ResourceType.RIVER,
                    abundance: 0.9,
                    seasonal: false,
                    accessibility: 0.95
                });
            }
            
            // Find the steepest descent neighbor
            let steepestX = currentX;
            let steepestY = currentY;
            let steepestElevation = currentElevation;
            
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const newX = currentX + dx;
                    const newY = currentY + dy;
                    
                    if (newX >= 0 && newX < mapSize && newY >= 0 && newY < mapSize) {
                        const neighborElevation = terrain[newY]![newX]!.geology.elevation;
                        if (neighborElevation < steepestElevation) {
                            steepestX = newX;
                            steepestY = newY;
                            steepestElevation = neighborElevation;
                        }
                    }
                }
            }
            
            // If no lower neighbor found, river ends (reaches local minimum or edge)
            if (steepestX === currentX && steepestY === currentY) {
                break;
            }
            
            // If river reaches very low elevation (near water level), it ends
            if (steepestElevation < 15) {
                break;
            }
            
            currentX = steepestX;
            currentY = steepestY;
            currentElevation = steepestElevation;
        }
    }
    
    return updatedTerrain;
};

// Resource Generation Functions (Pure)
const generateResources = (geology: GeologyData, x: number, y: number): Resource[] => {
    const resources: Resource[] = [];
    const random = (seed: number) => (Math.sin(seed * 12.9898 + 78.233) % 1 + 1) / 2;
    
    // Water sources based on water table depth and elevation
    if (geology.waterTableDepth < 1.0) {
        resources.push({
            type: ResourceType.SPRING,
            abundance: 1.0 - geology.waterTableDepth,
            seasonal: false,
            accessibility: geology.stability
        });
    }
    
    // Rivers in low elevation areas with good drainage
    if (geology.elevation < 30 && geology.drainage > 0.7) {
        resources.push({
            type: ResourceType.RIVER,
            abundance: 0.8,
            seasonal: false,
            accessibility: 0.9
        });
    }
    
    // Seasonal streams in medium elevation with moderate drainage
    if (geology.elevation > 20 && geology.elevation < 60 && geology.drainage > 0.4) {
        resources.push({
            type: ResourceType.SEASONAL_STREAM,
            abundance: 0.6,
            seasonal: true,
            accessibility: 0.7
        });
    }
    
    // Food sources based on vegetation zones (elevation and moisture)
    const moistureLevel = 1.0 - (geology.waterTableDepth / 10.0); // Higher water table = more moisture
    const hasNearbyWater = resources.some(r => 
        r.type === ResourceType.SPRING || 
        r.type === ResourceType.RIVER || 
        r.type === ResourceType.SEASONAL_STREAM
    );
    
    // Lowland vegetation zone (0-30m elevation, high moisture)
    if (geology.elevation < 30 && geology.soilType !== SoilType.ROCK) {
        const berryChance = random(x * 100 + y * 200 + 1);
        const moistureBonus = hasNearbyWater ? 0.3 : moistureLevel * 0.2;
        
        if (berryChance > (0.6 - moistureBonus)) {
            resources.push({
                type: ResourceType.BERRIES,
                abundance: Math.min(0.9, 0.5 + moistureLevel * 0.4),
                seasonal: true,
                accessibility: 0.9
            });
        }
        
        // Edible plants thrive in moist lowlands
        const plantChance = random(x * 80 + y * 180 + 10);
        if (plantChance > (0.7 - moistureBonus)) {
            resources.push({
                type: ResourceType.EDIBLE_PLANTS,
                abundance: Math.min(0.8, 0.4 + moistureLevel * 0.4),
                seasonal: true,
                accessibility: 0.95
            });
        }
    }
    
    // Highland vegetation zone (30-60m elevation, mixed moisture)
    else if (geology.elevation >= 30 && geology.elevation < 60 && geology.soilType !== SoilType.ROCK) {
        const nutChance = random(x * 150 + y * 250 + 2);
        const elevationBonus = (geology.elevation - 30) / 30 * 0.2; // Higher elevation = better nuts
        
        if (nutChance > (0.7 - elevationBonus)) {
            resources.push({
                type: ResourceType.NUTS,
                abundance: Math.min(0.8, 0.5 + elevationBonus),
                seasonal: true,
                accessibility: 0.8
            });
        }
        
        // Berries still possible in highlands with good moisture
        if (moistureLevel > 0.4) {
            const berryChance = random(x * 100 + y * 200 + 1);
            if (berryChance > 0.8) {
                resources.push({
                    type: ResourceType.BERRIES,
                    abundance: 0.6,
                    seasonal: true,
                    accessibility: 0.8
                });
            }
        }
    }
    
    // Alpine zone (60m+ elevation, low moisture, specialized resources)
    else if (geology.elevation >= 60 && geology.soilType !== SoilType.ROCK) {
        // Only hardy, specialized plants survive at high elevation
        const alpinePlantChance = random(x * 300 + y * 400 + 11);
        if (alpinePlantChance > 0.85) {
            resources.push({
                type: ResourceType.EDIBLE_PLANTS,
                abundance: 0.3, // Scarce but high quality
                seasonal: true,
                accessibility: 0.6 // Harder to access
            });
        }
    }
    
    // Game trails in medium elevation areas with good access
    if (geology.elevation > 10 && geology.elevation < 70 && geology.stability > 0.6) {
        const gameChance = random(x * 80 + y * 120 + 3);
        if (gameChance > 0.75) {
            resources.push({
                type: ResourceType.GAME_TRAIL,
                abundance: 0.6,
                seasonal: false,
                accessibility: geology.stability
            });
        }
    }
    
    // Material resources based on bedrock and soil
    if (geology.bedrockType === BedrockType.LIMESTONE) {
        const flintChance = random(x * 200 + y * 300 + 4);
        if (flintChance > 0.85) {
            resources.push({
                type: ResourceType.FLINT,
                abundance: 0.7,
                seasonal: false,
                accessibility: 1.0 - geology.excavationCost / 5.0
            });
        }
    }
    
    if (geology.bedrockType === BedrockType.GRANITE && geology.elevation > 50) {
        const obsidianChance = random(x * 250 + y * 350 + 5);
        if (obsidianChance > 0.9) {
            resources.push({
                type: ResourceType.OBSIDIAN,
                abundance: 0.9,
                seasonal: false,
                accessibility: 0.3 // Very hard to access
            });
        }
    }
    
    // Clay deposits in clay soil with high water table
    if (geology.soilType === SoilType.CLAY && geology.waterTableDepth < 3.0) {
        resources.push({
            type: ResourceType.CLAY_DEPOSIT,
            abundance: 0.8,
            seasonal: false,
            accessibility: 1.0 - geology.excavationCost / 5.0
        });
    }
    
    // Wood resources based on vegetation zones
    if (geology.soilType !== SoilType.ROCK) {
        // Hardwood forests in lowlands with good soil and moisture
        if (geology.elevation < 40 && geology.soilType === SoilType.LOAM && moistureLevel > 0.5) {
            const hardwoodChance = random(x * 180 + y * 280 + 6);
            const forestBonus = hasNearbyWater ? 0.2 : 0;
            
            if (hardwoodChance > (0.5 - forestBonus)) {
                resources.push({
                    type: ResourceType.HARDWOOD,
                    abundance: Math.min(0.9, 0.6 + moistureLevel * 0.3),
                    seasonal: false,
                    accessibility: 0.8
                });
            }
        }
        
        // Softwood (coniferous) forests in highlands and areas with poor soil
        if (geology.elevation > 25 && geology.elevation < 80) {
            const softwoodChance = random(x * 220 + y * 320 + 7);
            const elevationBonus = geology.elevation > 50 ? 0.2 : 0; // Conifers prefer higher elevation
            
            if (softwoodChance > (0.6 - elevationBonus)) {
                resources.push({
                    type: ResourceType.SOFTWOOD,
                    abundance: geology.elevation > 50 ? 0.8 : 0.6,
                    seasonal: false,
                    accessibility: geology.elevation > 60 ? 0.7 : 0.9 // Harder to access at high elevation
                });
            }
        }
        
        // Mixed forests in mid-elevation areas with moderate conditions
        if (geology.elevation >= 20 && geology.elevation <= 45 && moistureLevel > 0.3) {
            const mixedChance = random(x * 250 + y * 350 + 12);
            if (mixedChance > 0.7) {
                // Add both types but with lower abundance
                resources.push({
                    type: ResourceType.HARDWOOD,
                    abundance: 0.5,
                    seasonal: false,
                    accessibility: 0.8
                });
                resources.push({
                    type: ResourceType.SOFTWOOD,
                    abundance: 0.5,
                    seasonal: false,
                    accessibility: 0.9
                });
            }
        }
    }
    
    // Shelter based on bedrock and elevation
    if (geology.elevation > 30 && geology.bedrockType !== BedrockType.SHALE) {
        const caveChance = random(x * 300 + y * 400 + 8);
        if (caveChance > 0.92) {
            resources.push({
                type: ResourceType.CAVE,
                abundance: 1.0,
                seasonal: false,
                accessibility: 0.6
            });
        }
        
        const shelterChance = random(x * 350 + y * 450 + 9);
        if (shelterChance > 0.85) {
            resources.push({
                type: ResourceType.ROCK_SHELTER,
                abundance: 0.8,
                seasonal: false,
                accessibility: 0.8
            });
        }
    }
    
    return resources;
};

// Terrain Creation Functions (Pure)
const createTileFromHeight = (x: number, y: number, elevation: number): TerrainTile => {
    elevation = Math.max(5, Math.min(150, elevation));
    
    const waterTableNoise = Math.sin(x * 0.01) * Math.cos(y * 0.01);
    const soilNoise = Math.sin(x * 0.03) * Math.sin(y * 0.04);
    
    let soilType: SoilType;
    if (elevation > 45) soilType = SoilType.ROCK;
    else if (soilNoise > 0.3) soilType = SoilType.SAND;
    else if (soilNoise < -0.3) soilType = SoilType.CLAY;
    else soilType = SoilType.LOAM;

    const bedrockTypes = [BedrockType.GRANITE, BedrockType.LIMESTONE, BedrockType.SANDSTONE, BedrockType.SHALE];
    const bedrockNoise = Math.sin(x * 0.005) * Math.cos(y * 0.005);
    const bedrockIndex = Math.floor((bedrockNoise + 1) * 2) % bedrockTypes.length;
    const bedrockType = bedrockTypes[bedrockIndex]!;

    const geology: GeologyData = {
        elevation: Math.round(elevation),
        soilType,
        soilDepth: Math.max(0.5, Math.min(8, 3 + soilNoise * 2)),
        bedrockType,
        waterTableDepth: Math.max(0, 5 + waterTableNoise * 8),
        drainage: soilType === SoilType.SAND ? 0.9 : soilType === SoilType.CLAY ? 0.2 : 0.6,
        stability: soilType === SoilType.ROCK ? 1.0 : soilType === SoilType.CLAY ? 0.4 : 0.7,
        excavationCost: soilType === SoilType.ROCK ? 4 : soilType === SoilType.CLAY ? 2 : 1.5
    };

    const resources = generateResources(geology, x, y);
    
    return {
        x,
        y,
        geology,
        buildable: elevation < 50 && geology.waterTableDepth > 0.5,
        resources
    };
};

const heightmapToTerrain = (heightmap: number[][], mapSize: number): TerrainTile[][] => {
    const terrain: TerrainTile[][] = [];
    
    for (let y = 0; y < mapSize; y++) {
        terrain[y] = [];
        for (let x = 0; x < mapSize; x++) {
            terrain[y]![x] = createTileFromHeight(x, y, heightmap[y]![x]!);
        }
    }
    
    // Generate rivers that flow from high to low elevation
    const terrainWithRivers = generateRivers(terrain, mapSize);
    
    return terrainWithRivers;
};

// Simulation Update Functions (Pure)
const shouldSimulate = (state: GameState): boolean => {
    const currentTime = performance.now();
    return state.simulation.isActive && 
           state.simulation.step < state.simulation.maxSteps && 
           currentTime - state.simulation.lastTime > state.simulation.speed;
};

const updateGeologicalSimulation = (state: GameState): GameState => {
    if (!shouldSimulate(state)) return state;
    
    const intensity = 1.0 - (state.simulation.step / state.simulation.maxSteps);
    
    const newHeightmap = pipe(
        (h: number[][]) => applyTectonicUplift(h, state.mapSize, intensity),
        (h: number[][]) => applyHydraulicErosion(h, state.mapSize),
        (h: number[][]) => applyThermalErosion(h, state.mapSize),
        (h: number[][]) => smoothEdges(h, state.mapSize)
    )(state.heightmap);
    
    return {
        ...state,
        heightmap: newHeightmap,
        terrain: heightmapToTerrain(newHeightmap, state.mapSize),
        simulation: {
            ...state.simulation,
            step: state.simulation.step + 1,
            lastTime: performance.now()
        }
    };
};

// Camera Functions (Pure)
const updateCameraFromInput = (state: GameState): GameState => {
    const isShiftHeld = state.keysPressed.has('shift');
    const isZHeld = state.keysPressed.has('z');
    
    let accelX = 0, accelY = 0, accelZ = 0;
    
    if (isZHeld) {
        if (state.keysPressed.has('arrowleft')) accelX -= state.camera.acceleration;
        if (state.keysPressed.has('arrowright')) accelX += state.camera.acceleration;
        if (state.keysPressed.has('arrowup')) accelZ += state.camera.acceleration;
        if (state.keysPressed.has('arrowdown')) accelZ -= state.camera.acceleration;
    } else if (isShiftHeld) {
        // Pan mode handled separately
        return updateCameraPan(state);
    } else {
        if (state.keysPressed.has('arrowleft')) accelX -= state.camera.acceleration;
        if (state.keysPressed.has('arrowright')) accelX += state.camera.acceleration;
        if (state.keysPressed.has('arrowup')) accelY += state.camera.acceleration;
        if (state.keysPressed.has('arrowdown')) accelY -= state.camera.acceleration;
    }
    
    // Update velocity
    let newVelocity = {
        x: state.camera.velocity.x + accelX,
        y: state.camera.velocity.y + accelY,
        z: state.camera.velocity.z + accelZ
    };
    
    // Clamp velocity
    const speed = Math.sqrt(newVelocity.x ** 2 + newVelocity.y ** 2 + newVelocity.z ** 2);
    if (speed > state.camera.maxSpeed) {
        const scale = state.camera.maxSpeed / speed;
        newVelocity = {
            x: newVelocity.x * scale,
            y: newVelocity.y * scale,
            z: newVelocity.z * scale
        };
    }
    
    // Apply damping
    if (accelX === 0) newVelocity.x *= state.camera.damping;
    if (accelY === 0) newVelocity.y *= state.camera.damping;
    if (accelZ === 0) newVelocity.z *= state.camera.damping;
    
    // Apply movement
    const movement = calculateCameraMovement(state, newVelocity);
    
    return {
        ...state,
        camera: {
            ...state.camera,
            velocity: newVelocity,
            position: {
                x: state.camera.position.x + movement.x,
                y: state.camera.position.y + movement.y,
                z: state.camera.position.z + movement.z
            },
            target: {
                x: state.camera.target.x + movement.x,
                y: state.camera.target.y + movement.y,
                z: state.camera.target.z + movement.z
            }
        }
    };
};

const updateCameraPan = (state: GameState): GameState => {
    let deltaX = 0, deltaY = 0;
    const panSpeed = state.camera.maxSpeed * 0.7;
    
    if (state.keysPressed.has('arrowleft')) deltaX = -panSpeed;
    if (state.keysPressed.has('arrowright')) deltaX = panSpeed;
    if (state.keysPressed.has('arrowup')) deltaY = panSpeed;
    if (state.keysPressed.has('arrowdown')) deltaY = -panSpeed;
    
    const panMovement = calculatePanMovement(state, deltaX, deltaY);
    
    return {
        ...state,
        camera: {
            ...state.camera,
            target: {
                x: state.camera.target.x + panMovement.x,
                y: state.camera.target.y + panMovement.y,
                z: state.camera.target.z + panMovement.z
            },
            position: updateCameraPositionFromTarget(state.camera)
        }
    };
};

const calculateCameraMovement = (state: GameState, velocity: Vector3): Vector3 => {
    const { camera } = state;
    const forward = normalize({
        x: camera.target.x - camera.position.x,
        y: camera.target.y - camera.position.y,
        z: camera.target.z - camera.position.z
    });
    
    const up = { x: 0, y: 1, z: 0 };
    const right = normalize(cross(forward, up));
    const cameraUp = cross(right, forward);
    
    return {
        x: right.x * velocity.x + cameraUp.x * velocity.y + forward.x * velocity.z,
        y: right.y * velocity.x + cameraUp.y * velocity.y + forward.y * velocity.z,
        z: right.z * velocity.x + cameraUp.z * velocity.y + forward.z * velocity.z
    };
};

const calculatePanMovement = (state: GameState, deltaX: number, deltaY: number): Vector3 => {
    const { camera } = state;
    const forward = normalize({
        x: camera.target.x - camera.position.x,
        y: camera.target.y - camera.position.y,
        z: camera.target.z - camera.position.z
    });
    
    const up = { x: 0, y: 1, z: 0 };
    const right = normalize(cross(forward, up));
    const cameraUp = cross(right, forward);
    
    return {
        x: right.x * deltaX + cameraUp.x * deltaY,
        y: right.y * deltaX + cameraUp.y * deltaY,
        z: right.z * deltaX + cameraUp.z * deltaY
    };
};

const updateCameraPositionFromTarget = (camera: GameState['camera']): Vector3 => {
    const direction = normalize({
        x: camera.position.x - camera.target.x,
        y: camera.position.y - camera.target.y,
        z: camera.position.z - camera.target.z
    });
    
    return {
        x: camera.target.x + direction.x * camera.distance,
        y: camera.target.y + direction.y * camera.distance,
        z: camera.target.z + direction.z * camera.distance
    };
};

const setupIsometricView = (state: GameState): GameState => {
    const horizontalAngle = Math.PI / 4;
    const verticalAngle = Math.PI / 6;
    
    const position = {
        x: state.camera.target.x + state.camera.distance * Math.cos(verticalAngle) * Math.cos(horizontalAngle),
        y: state.camera.target.y + state.camera.distance * Math.sin(verticalAngle),
        z: state.camera.target.z + state.camera.distance * Math.cos(verticalAngle) * Math.sin(horizontalAngle)
    };
    
    return {
        ...state,
        camera: {
            ...state.camera,
            position
        }
    };
};

// FPS Update Functions (Pure)
const updateFPS = (state: GameState): GameState => {
    const currentTime = performance.now();
    const newFrameCount = state.fps.frameCount + 1;
    const newTotalFrames = state.fps.totalFrames + 1;
    
    if (currentTime - state.fps.lastTime >= 1000) {
        return {
            ...state,
            fps: {
                current: Math.round(newFrameCount * 1000 / (currentTime - state.fps.lastTime)),
                frameCount: 0,
                totalFrames: newTotalFrames,
                lastTime: currentTime
            }
        };
    }
    
    return {
        ...state,
        fps: {
            ...state.fps,
            frameCount: newFrameCount,
            totalFrames: newTotalFrames
        }
    };
};

// Event Handlers (Pure)
const handleKeyDown = (state: GameState, event: KeyboardEvent): GameState => {
    if (!(event.metaKey || event.ctrlKey)) {
        event.preventDefault();
    }
    
    const key = event.key.toLowerCase();
    const newKeysPressed = new Set(state.keysPressed);
    newKeysPressed.add(key);
    
    let newState = { ...state, keysPressed: newKeysPressed };
    
    switch(key) {
        case ' ':
            newState = {
                ...newState,
                simulation: {
                    ...newState.simulation,
                    isActive: !newState.simulation.isActive
                }
            };
            console.log(newState.simulation.isActive ? 'Geological simulation resumed' : 'Geological simulation paused');
            break;
        case 'r':
            newState = restartGeologicalSimulation(newState);
            break;
        case 'w':
            newState = {
                ...newState,
                showWater: !newState.showWater
            };
            console.log(newState.showWater ? 'Water enabled' : 'Water disabled');
            break;
    }
    
    return newState;
};

const handleKeyUp = (state: GameState, event: KeyboardEvent): GameState => {
    const newKeysPressed = new Set(state.keysPressed);
    newKeysPressed.delete(event.key.toLowerCase());
    return { ...state, keysPressed: newKeysPressed };
};

const handleClick = (state: GameState, event: MouseEvent): GameState => {
    const rect = state.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const tileX = Math.floor((x / state.canvas.width) * state.mapSize);
    const tileY = Math.floor((y / state.canvas.height) * state.mapSize);
    
    if (state.terrain[tileY] && state.terrain[tileY]![tileX]) {
        updateTileInfo(state, state.terrain[tileY]![tileX]!);
    }
    
    return state;
};

const handleResize = (state: GameState): GameState => {
    state.canvas.width = window.innerWidth;
    state.canvas.height = window.innerHeight;
    
    // WebGPU canvas context automatically handles viewport
    // No explicit viewport call needed like WebGL
    
    return state;
};

// Terrain Generation
const generateTerrain = (state: GameState): GameState => {
    const heightmap = createHeightmap(state.mapSize);
    const terrain = heightmapToTerrain(heightmap, state.mapSize);
    
    return {
        ...state,
        heightmap,
        terrain,
        simulation: {
            ...state.simulation,
            step: 0,
            lastTime: performance.now()
        }
    };
};

const restartGeologicalSimulation = (state: GameState): GameState => {
    console.log('Restarting geological simulation...');
    return {
        ...generateTerrain(state),
        simulation: {
            ...state.simulation,
            isActive: true
        }
    };
};

// Resource Visualization Functions
const getResourceColor = (tile: TerrainTile): [number, number, number] => {
    const { resources } = tile;
    
    // Priority order: Water > Vegetation > Materials > Shelter > Base terrain
    
    // Water resources - use water/blue colors
    if (resources.some(r => r.type === ResourceType.RIVER)) {
        return [0.1, 0.6, 1.0]; // Bright blue for rivers
    }
    if (resources.some(r => r.type === ResourceType.SPRING)) {
        return [0.4, 0.8, 1.0]; // Light blue for springs
    }
    if (resources.some(r => r.type === ResourceType.SEASONAL_STREAM)) {
        return [0.6, 0.9, 1.0]; // Very light blue for seasonal streams
    }
    
    // Vegetation resources - use cyan/green colors
    if (resources.some(r => r.type === ResourceType.BERRIES)) {
        return [0.2, 1.0, 0.6]; // Bright cyan-green for berries
    }
    if (resources.some(r => r.type === ResourceType.NUTS)) {
        return [0.4, 1.0, 0.7]; // Light cyan-green for nuts
    }
    if (resources.some(r => r.type === ResourceType.EDIBLE_PLANTS)) {
        return [0.1, 0.9, 0.5]; // Darker cyan-green for edible plants
    }
    if (resources.some(r => r.type === ResourceType.HARDWOOD)) {
        return [0.0, 0.8, 0.4]; // Dark green for hardwood
    }
    if (resources.some(r => r.type === ResourceType.SOFTWOOD)) {
        return [0.2, 0.9, 0.6]; // Medium green for softwood
    }
    
    // Material resources - use distinct colors
    if (resources.some(r => r.type === ResourceType.OBSIDIAN)) {
        return [0.2, 0.2, 0.3]; // Dark grey-blue for obsidian
    }
    if (resources.some(r => r.type === ResourceType.FLINT)) {
        return [0.7, 0.7, 0.5]; // Tan/beige for flint
    }
    if (resources.some(r => r.type === ResourceType.CLAY_DEPOSIT)) {
        return [0.8, 0.5, 0.3]; // Orange-brown for clay
    }
    
    // Shelter resources - use warm colors
    if (resources.some(r => r.type === ResourceType.CAVE)) {
        return [0.6, 0.4, 0.2]; // Dark brown for caves
    }
    if (resources.some(r => r.type === ResourceType.ROCK_SHELTER)) {
        return [0.7, 0.6, 0.4]; // Light brown for rock shelters
    }
    
    // Game trails - use yellow
    if (resources.some(r => r.type === ResourceType.GAME_TRAIL)) {
        return [1.0, 0.9, 0.3]; // Bright yellow for game trails
    }
    
    // Base terrain color (no resources) - neutral grey
    return [0.6, 0.6, 0.6]; // Neutral grey for areas without resources
};

// WebGPU Rendering Functions
const createTerrainMesh = (state: GameState): GameState => {
    const { device, heightmap, terrain, mapSize, heightScale, waterLevel } = state;
    
    const vertexData: number[] = [];
    const indices: number[] = [];
    
    // Generate vertices from heightmap
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            const height = heightmap[y]![x]! * heightScale;
            
            // Position (centered around origin)
            vertexData.push(
                x - mapSize / 2,
                height,
                y - mapSize / 2
            );
            
            // Color based on resources and terrain
            if (height < waterLevel * heightScale) {
                // Underwater - bright blue (blue > 0.9 for water detection)
                vertexData.push(0.3, 0.3, 1.0);
            } else {
                // Get color based on resources and terrain
                const tile = terrain[y]![x]!;
                const [r, g, b] = getResourceColor(tile);
                vertexData.push(r, g, b);
            }
        }
    }
    
    // Generate indices for triangles
    for (let y = 0; y < mapSize - 1; y++) {
        for (let x = 0; x < mapSize - 1; x++) {
            const topLeft = y * mapSize + x;
            const topRight = topLeft + 1;
            const bottomLeft = (y + 1) * mapSize + x;
            const bottomRight = bottomLeft + 1;
            
            // First triangle
            indices.push(topLeft, bottomLeft, topRight);
            // Second triangle
            indices.push(topRight, bottomLeft, bottomRight);
        }
    }
    
    console.log('Terrain mesh created:');
    console.log('- Vertices:', vertexData.length / 6, '(', vertexData.length, 'floats)');
    console.log('- Indices:', indices.length / 3, 'triangles');
    
    // Pad indices to multiple of 4 bytes if necessary
    while ((indices.length * 2) % 4 !== 0) {
        indices.push(0);
    }
    
    // Create WebGPU buffers (ensure sizes are multiples of 4)
    const vertexSize = Math.ceil((vertexData.length * 4) / 4) * 4;
    const indexSize = Math.ceil((indices.length * 2) / 4) * 4;
    
    const vertexBuffer = device.createBuffer({
        size: vertexSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    
    device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(vertexData));
    
    const indexBuffer = device.createBuffer({
        size: indexSize,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    
    device.queue.writeBuffer(indexBuffer, 0, new Uint16Array(indices));
    
    return {
        ...state,
        buffers: {
            ...state.buffers,
            vertex: vertexBuffer,
            index: indexBuffer
        }
    };
};

const createWaterMesh = (state: GameState): GameState => {
    if (!state.showWater) {
        return {
            ...state,
            buffers: {
                ...state.buffers,
                waterVertex: null,
                waterIndex: null
            }
        };
    }
    
    const { device, heightmap, mapSize, waterLevel } = state;
    const waterVertexData: number[] = [];
    const waterIndices: number[] = [];
    let vertexIndex = 0;
    
    for (let y = 0; y < mapSize - 1; y++) {
        for (let x = 0; x < mapSize - 1; x++) {
            const corners = [
                heightmap[y]![x]!,
                heightmap[y]![x + 1]!,
                heightmap[y + 1]![x]!,
                heightmap[y + 1]![x + 1]!
            ];
            
            if (corners.some(height => height < waterLevel)) {
                const waterHeight = waterLevel * state.heightScale;
                const positions = [
                    [x - mapSize / 2, waterHeight, y - mapSize / 2],
                    [x + 1 - mapSize / 2, waterHeight, y - mapSize / 2],
                    [x - mapSize / 2, waterHeight, y + 1 - mapSize / 2],
                    [x + 1 - mapSize / 2, waterHeight, y + 1 - mapSize / 2]
                ];
                
                positions.forEach(pos => {
                    // Position
                    waterVertexData.push(pos[0]!, pos[1]!, pos[2]!);
                    // Color - translucent blue
                    waterVertexData.push(0.2, 0.6, 1.0);
                });
                
                waterIndices.push(
                    vertexIndex, vertexIndex + 1, vertexIndex + 2,
                    vertexIndex + 1, vertexIndex + 3, vertexIndex + 2
                );
                
                vertexIndex += 4;
            }
        }
    }
    
    if (waterVertexData.length > 0) {
        const waterVertexBuffer = device.createBuffer({
            size: waterVertexData.length * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        
        device.queue.writeBuffer(waterVertexBuffer, 0, new Float32Array(waterVertexData));
        
        const waterIndexBuffer = device.createBuffer({
            size: waterIndices.length * 2,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        
        device.queue.writeBuffer(waterIndexBuffer, 0, new Uint16Array(waterIndices));
        
        return {
            ...state,
            buffers: {
                ...state.buffers,
                waterVertex: waterVertexBuffer,
                waterIndex: waterIndexBuffer
            }
        };
    }
    
    return state;
};

// Matrix Functions (Pure)
const createProjectionMatrix = (canvas: HTMLCanvasElement): Matrix4 => {
    const fov = 45 * Math.PI / 180;
    const aspect = canvas.width / canvas.height;
    const near = 0.1;
    const far = 1000;
    
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);
    
    // WebGPU uses column-major order
    return {
        elements: new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ])
    };
};

const createModelViewMatrix = (camera: GameState['camera']): Matrix4 => {
    const eye = camera.position;
    const target = camera.target;
    const up = { x: 0, y: 1, z: 0 };
    
    const zAxis = normalize({
        x: eye.x - target.x,
        y: eye.y - target.y,
        z: eye.z - target.z
    });
    
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);
    
    return {
        elements: new Float32Array([
            xAxis.x, yAxis.x, zAxis.x, 0,
            xAxis.y, yAxis.y, zAxis.y, 0,
            xAxis.z, yAxis.z, zAxis.z, 0,
            -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1
        ])
    };
};

// Sun Rendering Function  
const renderSun = (_state: GameState, _passEncoder: any): void => {
    // For now, we'll skip actual sun rendering to keep it simple
    // The main feature is the lighting effect coming from the sun position
    // In a future version, we could render a bright sphere or billboard here
};

// WebGPU Render Function
const render = (state: GameState): void => {
    const { device, context, pipelines, buffers, bindGroups, canvas, camera } = state;
    
    if (!pipelines.terrain || !buffers.vertex || !buffers.index || !buffers.uniform || !bindGroups.terrain) {
        console.warn('Missing required resources for rendering');
        return;
    }
    
    // Update uniform buffer with matrices and sun data
    const projectionMatrix = createProjectionMatrix(canvas);
    const modelViewMatrix = createModelViewMatrix(camera);
    
    // Create uniform data: matrices + sun data
    const uniformData = new Float32Array(80); // 2 * 16 floats for matrices + 16 floats for sun + padding
    uniformData.set(modelViewMatrix.elements, 0);
    uniformData.set(projectionMatrix.elements, 16);
    
    // Sun data starting at offset 32 (after two 4x4 matrices)
    uniformData[32] = state.sun.position.x;
    uniformData[33] = state.sun.position.y;
    uniformData[34] = state.sun.position.z;
    uniformData[35] = 0; // padding
    
    uniformData[36] = state.sun.color.x;
    uniformData[37] = state.sun.color.y;
    uniformData[38] = state.sun.color.z;
    uniformData[39] = 0; // padding
    
    uniformData[40] = state.sun.intensity;
    uniformData[41] = 0; // padding
    uniformData[42] = 0; // padding
    uniformData[43] = 0; // padding
    
    device.queue.writeBuffer(buffers.uniform, 0, uniformData);
    
    // Create depth texture
    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    // Begin render pass
    const commandEncoder = device.createCommandEncoder();
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
        }
    };
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    // Render terrain
    passEncoder.setPipeline(pipelines.terrain);
    passEncoder.setBindGroup(0, bindGroups.terrain);
    passEncoder.setVertexBuffer(0, buffers.vertex);
    passEncoder.setIndexBuffer(buffers.index, 'uint16');
    
    // Calculate index count for terrain mesh
    const terrainIndexCount = (state.mapSize - 1) * (state.mapSize - 1) * 6;
    passEncoder.drawIndexed(terrainIndexCount);
    
    // Render water if available
    if (buffers.waterVertex && buffers.waterIndex) {
        passEncoder.setVertexBuffer(0, buffers.waterVertex);
        passEncoder.setIndexBuffer(buffers.waterIndex, 'uint16');
        
        // Calculate water index count dynamically
        const waterBufferSize = buffers.waterIndex.size;
        const waterIndexCount = waterBufferSize / 2;
        passEncoder.drawIndexed(waterIndexCount);
    }
    
    // Render the sun as a bright sphere
    renderSun(state, passEncoder);
    
    passEncoder.end();
    
    // Submit commands
    device.queue.submit([commandEncoder.finish()]);
    
    // Clean up depth texture
    depthTexture.destroy();
};

// UI Update Functions (Side Effects)
const updateTileInfo = (state: GameState, tile: TerrainTile): void => {
    if (!state.elements.tileInfo) return;
    
    const geology = tile.geology;
    state.elements.tileInfo.innerHTML = `
        <div class="tile-coord">Tile (${tile.x}, ${tile.y})</div>
        
        <div class="property">
            <span class="label">Elevation:</span>
            <span class="value">${geology.elevation}m</span>
        </div>
        
        <div class="property">
            <span class="label">Soil Type:</span>
            <span class="value">${geology.soilType}</span>
        </div>
        
        <div class="property">
            <span class="label">Bedrock:</span>
            <span class="value">${geology.bedrockType}</span>
        </div>
        
        <div class="property">
            <span class="label">Soil Depth:</span>
            <span class="value">${geology.soilDepth.toFixed(1)}m</span>
        </div>
        
        <div class="property">
            <span class="label">Water Table:</span>
            <span class="value">${geology.waterTableDepth.toFixed(1)}m</span>
        </div>
        
        <div class="property">
            <span class="label">Drainage:</span>
            <span class="value">${(geology.drainage * 100).toFixed(0)}%</span>
        </div>
        
        <div class="property">
            <span class="label">Stability:</span>
            <span class="value">${(geology.stability * 100).toFixed(0)}%</span>
        </div>
        
        <div class="property">
            <span class="label">Excavation Cost:</span>
            <span class="value">${geology.excavationCost.toFixed(1)}x</span>
        </div>
        
        <div class="property">
            <span class="label">Status:</span>
            <span class="value ${tile.buildable ? 'buildable-yes' : 'buildable-no'}">
                ${tile.buildable ? 'Buildable' : 'Not Buildable'}
            </span>
        </div>
    `;
};

const updateFPSDisplay = (state: GameState): void => {
    if (!state.elements.fpsCounter) return;
    
    const simInfo = state.simulation.step < state.simulation.maxSteps
        ? `<br>GEOLOGICAL STEP: ${state.simulation.step}/${state.simulation.maxSteps}`
        : '';
    
    state.elements.fpsCounter.innerHTML = `FPS: ${state.fps.current}<br>FRAME: ${state.fps.totalFrames}${simInfo}`;
};

// Main Game Function
const createGame = async (): Promise<void> => {
    try {
        // Initialize WebGPU and create initial state
        let state = await createInitialState();
        
        // Setup rendering pipelines
        state = createRenderPipelines(state);
        
        // Generate initial terrain
        state = generateTerrain(state);
        state = createTerrainMesh(state);
        state = createWaterMesh(state);
        state = setupIsometricView(state);
        
        // Event listeners with closure over state
        const setupEventListeners = () => {
            window.addEventListener('resize', () => {
                state = handleResize(state);
            });
            
            window.addEventListener('keydown', (e: KeyboardEvent) => {
                state = handleKeyDown(state, e);
            });
            
            window.addEventListener('keyup', (e: KeyboardEvent) => {
                state = handleKeyUp(state, e);
            });
            
            state.canvas.addEventListener('click', (e: MouseEvent) => {
                state = handleClick(state, e);
            });
            
            state.canvas.focus();
        };
        
        setupEventListeners();
        
        // Game loop
        const gameLoop = () => {
            const previousStep = state.simulation.step;
            
            // Update state
            state = pipe(
                updateFPS,
                updateGeologicalSimulation,
                updateCameraFromInput
            )(state);
            
            // Update terrain mesh if simulation step changed
            if (state.simulation.step > previousStep) {
                state = createTerrainMesh(state);
                state = createWaterMesh(state);
            }
            
            // Side effects
            render(state);
            updateFPSDisplay(state);
            
            requestAnimationFrame(gameLoop);
        };
        
        console.log('Vibe City WebGPU 3D initialized');
        console.log('WebGPU 3D Geological terrain loaded!');
        console.log('Initial state:', {
            device: !!state.device,
            pipelines: {
                terrain: !!state.pipelines.terrain,
                lines: !!state.pipelines.lines
            },
            buffers: {
                vertex: !!state.buffers.vertex,
                index: !!state.buffers.index,
                uniform: !!state.buffers.uniform
            },
            mapSize: state.mapSize,
            heightScale: state.heightScale,
            camera: state.camera,
            sun: state.sun
        });
        
        gameLoop();
        
    } catch (error) {
        console.error('Failed to initialize WebGPU game:', error);
        
        // Fallback error message
        const container = document.getElementById('three-container');
        if (container) {
            container.innerHTML = `
                <div style="color: #ff0080; text-align: center; padding: 50px; font-family: monospace;">
                    <h2>WebGPU Not Supported</h2>
                    <p>This game requires WebGPU support.</p>
                    <p>Please use a modern browser with WebGPU enabled.</p>
                    <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
                </div>
            `;
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    createGame().catch(console.error);
});

// Export types and functions for testing (only in module environments)
// When running in browser, these exports are ignored due to tsconfig "module": "None"