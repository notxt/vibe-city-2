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
    // Canvas and WebGL
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext;
    
    // Terrain
    terrain: TerrainTile[][];
    heightmap: number[][];
    mapSize: number;
    heightScale: number;
    waterLevel: number;
    showWater: boolean;
    
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
    
    // Rendering
    shaders: {
        terrain: WebGLProgram | null;
        lines: WebGLProgram | null;
    };
    buffers: {
        vertex: WebGLBuffer | null;
        index: WebGLBuffer | null;
        color: WebGLBuffer | null;
        contourVertex: WebGLBuffer | null;
        contourColor: WebGLBuffer | null;
        waterVertex: WebGLBuffer | null;
        waterIndex: WebGLBuffer | null;
        waterColor: WebGLBuffer | null;
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

// WebGL Shader Functions (Side Effects)
const createShader = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
};

const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram();
    if (!program) return null;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    
    return program;
};

// Shader Sources
const getTerrainVertexShader = () => `
    attribute vec3 a_position;
    attribute vec3 a_color;
    
    uniform mat4 u_modelViewMatrix;
    uniform mat4 u_projectionMatrix;
    
    varying vec3 v_color;
    varying vec3 v_position;
    
    void main() {
        vec4 mvPosition = u_modelViewMatrix * vec4(a_position, 1.0);
        gl_Position = u_projectionMatrix * mvPosition;
        v_color = a_color;
        v_position = a_position;
    }
`;

const getTerrainFragmentShader = () => `
    precision mediump float;
    
    varying vec3 v_color;
    varying vec3 v_position;
    
    void main() {
        // Enhanced vaporwave lighting effects
        float heightFactor = v_position.y / 60.0;
        
        // Create multiple lighting layers for vaporwave effect
        float baseLight = 0.4 + 0.6 * heightFactor;
        float rimLight = pow(1.0 - abs(heightFactor - 0.5) * 2.0, 3.0) * 0.8;
        float gradientLight = sin(v_position.y * 0.1) * 0.3 + 0.7;
        
        // Combine lighting effects
        float totalLight = baseLight + rimLight + gradientLight;
        totalLight = clamp(totalLight, 0.3, 2.0);
        
        // Add subtle color variation based on position
        vec3 colorShift = vec3(
            sin(v_position.y * 0.05) * 0.1,
            0.0,
            cos(v_position.y * 0.05) * 0.1
        );
        
        vec3 finalColor = (v_color + colorShift) * totalLight;
        
        // Make water semi-transparent, terrain opaque
        float alpha = v_color.b > 0.8 ? 0.7 : 1.0;
        gl_FragColor = vec4(finalColor, alpha);
    }
`;

const getLineVertexShader = () => `
    attribute vec3 a_position;
    attribute vec3 a_color;
    
    uniform mat4 u_modelViewMatrix;
    uniform mat4 u_projectionMatrix;
    
    varying vec3 v_color;
    
    void main() {
        vec4 mvPosition = u_modelViewMatrix * vec4(a_position, 1.0);
        gl_Position = u_projectionMatrix * mvPosition;
        gl_PointSize = 3.0;
        v_color = a_color;
    }
`;

const getLineFragmentShader = () => `
    precision mediump float;
    
    varying vec3 v_color;
    
    void main() {
        gl_FragColor = vec4(v_color, 1.0);
    }
`;

// State Creation Functions
const createInitialState = (): GameState => {
    const container = document.getElementById('three-container');
    const tileInfo = document.getElementById('tile-info');
    const fpsCounter = document.getElementById('fps-counter');
    
    // Create WebGL canvas
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.tabIndex = 0;
    
    const gl = canvas.getContext('webgl');
    if (!gl) {
        throw new Error('WebGL not supported');
    }
    
    if (container) {
        container.appendChild(canvas);
    }
    
    return {
        canvas,
        gl,
        terrain: [],
        heightmap: [],
        mapSize: 50,
        heightScale: 1.0,
        waterLevel: 35,
        showWater: true,
        camera: {
            position: { x: 40, y: 80, z: 40 },
            target: { x: 0, y: 50, z: 0 },
            distance: 80,
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
        shaders: {
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
            waterColor: null
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

// WebGL Setup Functions (Side Effects)
const setupWebGL = (state: GameState): void => {
    const { gl } = state;
    
    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Set clear color to deeper purple/black for enhanced vaporwave aesthetic
    gl.clearColor(0.05, 0.0, 0.15, 1.0);
    
    // Set viewport
    gl.viewport(0, 0, state.canvas.width, state.canvas.height);
};

const initShaders = (state: GameState): GameState => {
    const { gl } = state;
    
    // Create terrain shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, getTerrainVertexShader());
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, getTerrainFragmentShader());
    
    if (!vertexShader || !fragmentShader) {
        throw new Error('Failed to create terrain shaders');
    }
    
    const terrainProgram = createProgram(gl, vertexShader, fragmentShader);
    if (!terrainProgram) {
        throw new Error('Failed to create terrain shader program');
    }
    
    // Create line shaders
    const lineVertexShader = createShader(gl, gl.VERTEX_SHADER, getLineVertexShader());
    const lineFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, getLineFragmentShader());
    
    if (!lineVertexShader || !lineFragmentShader) {
        throw new Error('Failed to create line shaders');
    }
    
    const linesProgram = createProgram(gl, lineVertexShader, lineFragmentShader);
    if (!linesProgram) {
        throw new Error('Failed to create line shader program');
    }
    
    return {
        ...state,
        shaders: {
            terrain: terrainProgram,
            lines: linesProgram
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

    return {
        x,
        y,
        geology,
        buildable: elevation < 50 && geology.waterTableDepth > 0.5
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
    
    return terrain;
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
    state.gl.viewport(0, 0, state.canvas.width, state.canvas.height);
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

// Rendering Functions (Side Effects)
const createTerrainMesh = (state: GameState): GameState => {
    const { gl, terrain, mapSize, heightScale } = state;
    
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    
    // Generate vertices and colors
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            if (terrain[y] && terrain[y]![x]) {
                const tile = terrain[y]![x]!;
                
                vertices.push(
                    x - mapSize / 2,
                    tile.geology.elevation * heightScale,
                    y - mapSize / 2
                );
                
                const elevation = tile.geology.elevation;
                
                if (elevation < 25) {
                    colors.push(0.0, 1.0, 1.0); // Bright cyan
                } else if (elevation < 35) {
                    colors.push(0.0, 0.7, 1.0); // Electric blue
                } else if (elevation < 45) {
                    colors.push(0.0, 1.0, 0.0); // Bright neon green
                } else if (elevation < 55) {
                    colors.push(0.5, 1.0, 0.0); // Electric yellow-green
                } else {
                    colors.push(1.0, 0.0, 1.0); // Hot pink/magenta
                }
            }
        }
    }
    
    // Generate indices
    for (let y = 0; y < mapSize - 1; y++) {
        for (let x = 0; x < mapSize - 1; x++) {
            const topLeft = y * mapSize + x;
            const topRight = y * mapSize + x + 1;
            const bottomLeft = (y + 1) * mapSize + x;
            const bottomRight = (y + 1) * mapSize + x + 1;
            
            indices.push(topLeft, bottomLeft, topRight);
            indices.push(topRight, bottomLeft, bottomRight);
        }
    }
    
    // Create buffers
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    return {
        ...state,
        buffers: {
            ...state.buffers,
            vertex: vertexBuffer,
            color: colorBuffer,
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
                waterColor: null,
                waterIndex: null
            }
        };
    }
    
    const { gl, heightmap, mapSize, waterLevel } = state;
    const waterVertices: number[] = [];
    const waterColors: number[] = [];
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
                const positions = [
                    [x - mapSize / 2, waterLevel, y - mapSize / 2],
                    [x + 1 - mapSize / 2, waterLevel, y - mapSize / 2],
                    [x - mapSize / 2, waterLevel, y + 1 - mapSize / 2],
                    [x + 1 - mapSize / 2, waterLevel, y + 1 - mapSize / 2]
                ];
                
                positions.forEach(pos => {
                    waterVertices.push(pos[0]!, pos[1]!, pos[2]!);
                    waterColors.push(0.0, 1.0, 1.0); // Bright cyan
                });
                
                waterIndices.push(
                    vertexIndex, vertexIndex + 1, vertexIndex + 2,
                    vertexIndex + 1, vertexIndex + 3, vertexIndex + 2
                );
                
                vertexIndex += 4;
            }
        }
    }
    
    if (waterVertices.length > 0) {
        const waterVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, waterVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(waterVertices), gl.STATIC_DRAW);
        
        const waterColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, waterColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(waterColors), gl.STATIC_DRAW);
        
        const waterIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, waterIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(waterIndices), gl.STATIC_DRAW);
        
        return {
            ...state,
            buffers: {
                ...state.buffers,
                waterVertex: waterVertexBuffer,
                waterColor: waterColorBuffer,
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
    
    return {
        elements: new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
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

// Render Function (Side Effects)
const render = (state: GameState): void => {
    const { gl, shaders, buffers, mapSize, canvas, camera } = state;
    
    if (!shaders.terrain || !buffers.vertex || !buffers.color || !buffers.index) return;
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    const projectionMatrix = createProjectionMatrix(canvas);
    const modelViewMatrix = createModelViewMatrix(camera);
    
    // Render terrain
    gl.useProgram(shaders.terrain);
    
    const projMatrixLocation = gl.getUniformLocation(shaders.terrain, 'u_projectionMatrix');
    const mvMatrixLocation = gl.getUniformLocation(shaders.terrain, 'u_modelViewMatrix');
    
    gl.uniformMatrix4fv(projMatrixLocation, false, projectionMatrix.elements);
    gl.uniformMatrix4fv(mvMatrixLocation, false, modelViewMatrix.elements);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertex);
    const positionLocation = gl.getAttribLocation(shaders.terrain, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    const colorLocation = gl.getAttribLocation(shaders.terrain, 'a_color');
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
    const indexCount = (mapSize - 1) * (mapSize - 1) * 6;
    
    gl.lineWidth(2.5);
    for (let i = 0; i < indexCount; i += 3) {
        gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2);
    }
    
    // Render water
    if (buffers.waterVertex && buffers.waterColor && buffers.waterIndex) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.waterVertex);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.waterColor);
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.waterIndex);
        const waterBufferSize = gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER, gl.BUFFER_SIZE);
        const waterIndexCount = waterBufferSize / 2;
        gl.drawElements(gl.TRIANGLES, waterIndexCount, gl.UNSIGNED_SHORT, 0);
    }
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
const createGame = (): void => {
    let state = createInitialState();
    
    // Setup
    setupWebGL(state);
    state = initShaders(state);
    state = generateTerrain(state);
    state = createTerrainMesh(state);
    state = createWaterMesh(state);
    state = setupIsometricView(state);
    
    // Event listeners with closure over state
    const setupEventListeners = () => {
        window.addEventListener('resize', () => {
            state = handleResize(state);
        });
        
        window.addEventListener('keydown', (e) => {
            state = handleKeyDown(state, e);
        });
        
        window.addEventListener('keyup', (e) => {
            state = handleKeyUp(state, e);
        });
        
        state.canvas.addEventListener('click', (e) => {
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
    
    console.log('Vibe City WebGL 3D initialized');
    console.log('WebGL 3D Geological terrain with contours loaded!');
    
    gameLoop();
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    createGame();
});

// Export types and functions for testing (only in module environments)
// When running in browser, these exports are ignored due to tsconfig "module": "None"