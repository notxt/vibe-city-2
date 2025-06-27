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

class VibeCity {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext;
    private container: HTMLElement | null;
    private tileInfo: HTMLElement | null;
    
    private terrain: TerrainTile[][];
    private shaderProgram: WebGLProgram | null = null;
    private lineShaderProgram: WebGLProgram | null = null;
    private vertexBuffer: WebGLBuffer | null = null;
    private indexBuffer: WebGLBuffer | null = null;
    private colorBuffer: WebGLBuffer | null = null;
    private contourVertexBuffer: WebGLBuffer | null = null;
    private contourColorBuffer: WebGLBuffer | null = null;
    
    private mapSize: number = 100;
    private heightScale: number = 0.8; // Very gentle height variations for overview
    
    // Camera and interaction - Wide landscape overview
    private cameraPosition: Vector3 = { x: 120, y: 100, z: 120 };
    private cameraTarget: Vector3 = { x: 0, y: 8, z: 0 }; // Look at center terrain height
    private cameraDistance: number = 200;
    
    constructor() {
        this.container = document.getElementById('three-container');
        this.tileInfo = document.getElementById('tile-info');
        this.terrain = [];
        
        // Create WebGL canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        const gl = this.canvas.getContext('webgl');
        if (!gl) {
            throw new Error('WebGL not supported');
        }
        this.gl = gl;
        
        if (this.container) {
            this.container.appendChild(this.canvas);
        }
        
        this.init();
    }
    
    private init(): void {
        this.initShaders();
        this.setupEventListeners();
        this.setupWebGL();
        
        console.log('Vibe City WebGL 3D initialized');
        
        // Auto-start the game
        this.startGame();
    }
    
    private setupWebGL(): void {
        // Enable depth testing
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        
        // Set clear color to black for 80's arcade look
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    private initShaders(): void {
        // Terrain shaders
        const vertexShaderSource = `
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
        
        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec3 v_color;
            varying vec3 v_position;
            
            void main() {
                // Simple lighting based on height
                float lightIntensity = 0.6 + 0.4 * (v_position.y / 60.0);
                gl_FragColor = vec4(v_color * lightIntensity, 1.0);
            }
        `;
        
        // Line shaders for contours
        const lineVertexShaderSource = `
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
        
        const lineFragmentShaderSource = `
            precision mediump float;
            
            varying vec3 v_color;
            
            void main() {
                gl_FragColor = vec4(v_color, 1.0);
            }
        `;
        
        // Create terrain shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        if (!vertexShader || !fragmentShader) {
            throw new Error('Failed to create terrain shaders');
        }
        
        this.shaderProgram = this.createProgram(vertexShader, fragmentShader);
        if (!this.shaderProgram) {
            throw new Error('Failed to create terrain shader program');
        }
        
        // Create line shaders
        const lineVertexShader = this.createShader(this.gl.VERTEX_SHADER, lineVertexShaderSource);
        const lineFragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, lineFragmentShaderSource);
        
        if (!lineVertexShader || !lineFragmentShader) {
            throw new Error('Failed to create line shaders');
        }
        
        this.lineShaderProgram = this.createProgram(lineVertexShader, lineFragmentShader);
        if (!this.lineShaderProgram) {
            throw new Error('Failed to create line shader program');
        }
    }
    
    private createShader(type: number, source: string): WebGLShader | null {
        const shader = this.gl.createShader(type);
        if (!shader) return null;
        
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
        const program = this.gl.createProgram();
        if (!program) return null;
        
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }
    
    private setupEventListeners(): void {
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('keydown', (e) => this.handleKeyPress(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // Make canvas focusable for keyboard controls
        this.canvas.tabIndex = 0;
        this.canvas.focus();
    }
    
    private handleResize(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    private keysPressed: Set<string> = new Set();
    
    private handleKeyPress(event: KeyboardEvent): void {
        // Don't prevent default for browser shortcuts like Cmd+R
        if (!(event.metaKey || event.ctrlKey)) {
            event.preventDefault();
        }
        this.keysPressed.add(event.key.toLowerCase());
        
        switch(event.key.toLowerCase()) {
            case '+':
            case '=':
                this.heightScale = Math.min(5.0, this.heightScale + 0.2);
                this.createTerrainMesh();
                this.createContourLines();
                break;
            case '-':
                this.heightScale = Math.max(0.2, this.heightScale - 0.2);
                this.createTerrainMesh();
                this.createContourLines();
                break;
        }
    }
    
    private handleKeyUp(event: KeyboardEvent): void {
        this.keysPressed.delete(event.key.toLowerCase());
    }
    
    private updateCameraFromKeys(): void {
        const rotationSpeed = 0.02;
        const zoomSpeed = 3;
        
        // Camera rotation with arrow keys or WASD
        if (this.keysPressed.has('arrowleft') || this.keysPressed.has('a')) {
            this.rotateCameraAroundTarget(-rotationSpeed, 0);
        }
        if (this.keysPressed.has('arrowright') || this.keysPressed.has('d')) {
            this.rotateCameraAroundTarget(rotationSpeed, 0);
        }
        if (this.keysPressed.has('arrowup') || this.keysPressed.has('w')) {
            this.rotateCameraAroundTarget(0, -rotationSpeed);
        }
        if (this.keysPressed.has('arrowdown') || this.keysPressed.has('s')) {
            this.rotateCameraAroundTarget(0, rotationSpeed);
        }
        
        // Zoom with Q/E or PageUp/PageDown
        if (this.keysPressed.has('q') || this.keysPressed.has('pageup')) {
            this.cameraDistance = Math.max(80, this.cameraDistance - zoomSpeed);
            this.updateCameraPosition();
        }
        if (this.keysPressed.has('e') || this.keysPressed.has('pagedown')) {
            this.cameraDistance = Math.min(400, this.cameraDistance + zoomSpeed);
            this.updateCameraPosition();
        }
    }
    
    private handleClick(event: MouseEvent): void {
        // Simple click-to-inspect: use mouse position to estimate terrain tile
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Convert screen coordinates to terrain coordinates (simplified)
        const tileX = Math.floor((x / this.canvas.width) * this.mapSize);
        const tileY = Math.floor((y / this.canvas.height) * this.mapSize);
        
        if (this.terrain[tileY] && this.terrain[tileY]![tileX]) {
            this.updateTileInfo(this.terrain[tileY]![tileX]!);
        }
    }
    
    
    private rotateCameraAroundTarget(deltaX: number, deltaY: number): void {
        // Calculate current spherical coordinates
        const dx = this.cameraPosition.x - this.cameraTarget.x;
        const dy = this.cameraPosition.y - this.cameraTarget.y;
        const dz = this.cameraPosition.z - this.cameraTarget.z;
        
        // Convert to spherical coordinates
        const theta = Math.atan2(dx, dz);
        const phi = Math.acos(dy / this.cameraDistance);
        
        // Apply rotation deltas
        const newTheta = theta + deltaX;
        const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + deltaY));
        
        // Convert back to cartesian and update camera position
        this.cameraPosition.x = this.cameraTarget.x + this.cameraDistance * Math.sin(newPhi) * Math.sin(newTheta);
        this.cameraPosition.y = this.cameraTarget.y + this.cameraDistance * Math.cos(newPhi);
        this.cameraPosition.z = this.cameraTarget.z + this.cameraDistance * Math.sin(newPhi) * Math.cos(newTheta);
    }
    
    private updateCameraPosition(): void {
        // Update camera based on current distance
        const direction = this.normalize({
            x: this.cameraPosition.x - this.cameraTarget.x,
            y: this.cameraPosition.y - this.cameraTarget.y,
            z: this.cameraPosition.z - this.cameraTarget.z
        });
        
        this.cameraPosition.x = this.cameraTarget.x + direction.x * this.cameraDistance;
        this.cameraPosition.y = this.cameraTarget.y + direction.y * this.cameraDistance;
        this.cameraPosition.z = this.cameraTarget.z + direction.z * this.cameraDistance;
    }
    
    private normalize(v: Vector3): Vector3 {
        const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        return {
            x: v.x / length,
            y: v.y / length,
            z: v.z / length
        };
    }
    
    private startGame(): void {
        this.generateTerrain();
        this.createTerrainMesh();
        this.createContourLines();
        this.setupIsometricView();
        this.animate();
        
        console.log('WebGL 3D Geological terrain with contours loaded!');
    }
    
    private setupIsometricView(): void {
        // Set up classic isometric camera angle (45 degrees from sides, looking down at 30 degrees)
        const horizontalAngle = Math.PI / 4; // 45 degrees
        const verticalAngle = Math.PI / 6;   // 30 degrees from horizontal
        
        this.cameraPosition.x = this.cameraTarget.x + this.cameraDistance * Math.cos(verticalAngle) * Math.cos(horizontalAngle);
        this.cameraPosition.y = this.cameraTarget.y + this.cameraDistance * Math.sin(verticalAngle);
        this.cameraPosition.z = this.cameraTarget.z + this.cameraDistance * Math.cos(verticalAngle) * Math.sin(horizontalAngle);
    }
    
    private generateTerrain(): void {
        this.terrain = [];
        
        for (let y = 0; y < this.mapSize; y++) {
            this.terrain[y] = [];
            for (let x = 0; x < this.mapSize; x++) {
                this.terrain[y]![x] = this.generateTile(x, y);
            }
        }
    }
    
    private generateTile(x: number, y: number): TerrainTile {
        // Enhanced noise for better 3D terrain
        const scale = 0.02;
        const elevation = Math.abs(
            Math.sin(x * scale) * Math.cos(y * scale) +
            Math.sin(x * scale * 2) * Math.cos(y * scale * 2) * 0.5 +
            Math.sin(x * scale * 4) * Math.cos(y * scale * 4) * 0.25
        ) * 50 + 10; // 10-60 meter range
        
        const waterTableNoise = Math.sin(x * 0.01) * Math.cos(y * 0.01);
        const soilNoise = Math.sin(x * 0.03) * Math.sin(y * 0.04);
        
        // Determine soil type based on elevation and noise
        let soilType: SoilType;
        if (elevation > 45) soilType = SoilType.ROCK;
        else if (soilNoise > 0.3) soilType = SoilType.SAND;
        else if (soilNoise < -0.3) soilType = SoilType.CLAY;
        else soilType = SoilType.LOAM;

        // Determine bedrock type
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
    }
    
    private createTerrainMesh(): void {
        if (!this.shaderProgram) return;
        
        const vertices: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        
        // Generate vertices and colors
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                if (this.terrain[y] && this.terrain[y]![x]) {
                    const tile = this.terrain[y]![x]!;
                    
                    // Position (centered around origin)
                    vertices.push(
                        x - this.mapSize / 2,
                        tile.geology.elevation * this.heightScale,
                        y - this.mapSize / 2
                    );
                    
                    // Color based on soil type
                    const color = this.getSoilColor(tile.geology.soilType);
                    colors.push(color.r, color.g, color.b);
                }
            }
        }
        
        // Generate indices for triangles
        for (let y = 0; y < this.mapSize - 1; y++) {
            for (let x = 0; x < this.mapSize - 1; x++) {
                const topLeft = y * this.mapSize + x;
                const topRight = y * this.mapSize + x + 1;
                const bottomLeft = (y + 1) * this.mapSize + x;
                const bottomRight = (y + 1) * this.mapSize + x + 1;
                
                // Two triangles per quad
                indices.push(topLeft, bottomLeft, topRight);
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }
        
        // Create buffers
        this.vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
        
        this.colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
        
        this.indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);
    }
    
    private createContourLines(): void {
        if (!this.lineShaderProgram) return;
        
        const contourVertices: number[] = [];
        const contourColors: number[] = [];
        
        // Generate contour lines at different elevations
        const contourInterval = 5; // Contour every 5m
        
        // Find elevation range
        let minElev = Infinity;
        let maxElev = -Infinity;
        
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                if (this.terrain[y] && this.terrain[y]![x]) {
                    const elev = this.terrain[y]![x]!.geology.elevation;
                    minElev = Math.min(minElev, elev);
                    maxElev = Math.max(maxElev, elev);
                }
            }
        }
        
        // Generate contour lines using a simple grid sampling approach
        for (let elevation = Math.ceil(minElev / contourInterval) * contourInterval; elevation <= maxElev; elevation += contourInterval) {
            const isMajor = elevation % 10 === 0;
            const color = isMajor ? 
                { r: 1.0, g: 1.0, b: 0.0 } :  // Bright yellow for major
                { r: 0.0, g: 1.0, b: 0.0 }; // Bright green for minor
            
            this.generateContourPointsForElevation(elevation, contourVertices, contourColors, color);
        }
        
        // Create contour buffers only if we have vertices
        if (contourVertices.length > 0) {
            this.contourVertexBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.contourVertexBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(contourVertices), this.gl.STATIC_DRAW);
            
            this.contourColorBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.contourColorBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(contourColors), this.gl.STATIC_DRAW);
        } else {
            this.contourVertexBuffer = null;
            this.contourColorBuffer = null;
        }
    }
    
    private generateContourPointsForElevation(
        targetElevation: number, 
        vertices: number[], 
        colors: number[], 
        color: { r: number, g: number, b: number }
    ): void {
        // Simple approach: find points close to target elevation and mark them
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                if (!this.terrain[y] || !this.terrain[y]![x]) continue;
                
                const tile = this.terrain[y]![x]!;
                const elev = tile.geology.elevation;
                
                // If this point is close to our target elevation (within 1m)
                if (Math.abs(elev - targetElevation) < 1.0) {
                    vertices.push(
                        x - this.mapSize / 2,
                        elev * this.heightScale + 0.5, // Slightly above terrain
                        y - this.mapSize / 2
                    );
                    colors.push(color.r, color.g, color.b);
                }
            }
        }
    }
    
    private getSoilColor(soilType: SoilType): { r: number, g: number, b: number } {
        switch (soilType) {
            case SoilType.SAND:
                return { r: 0.0, g: 1.0, b: 1.0 }; // Bright cyan
            case SoilType.CLAY:
                return { r: 1.0, g: 0.0, b: 0.5 }; // Bright magenta
            case SoilType.ROCK:
                return { r: 0.0, g: 0.5, b: 1.0 }; // Bright blue
            case SoilType.LOAM:
            default:
                return { r: 0.0, g: 1.0, b: 0.0 }; // Bright neon green
        }
    }
    
    
    private updateTileInfo(tile: TerrainTile): void {
        if (!this.tileInfo) return;
        
        const geology = tile.geology;
        this.tileInfo.innerHTML = `
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
    }
    
    private animate(): void {
        requestAnimationFrame(() => this.animate());
        this.updateCameraFromKeys();
        this.render();
    }
    
    private render(): void {
        if (!this.shaderProgram || !this.vertexBuffer || !this.colorBuffer || !this.indexBuffer) return;
        
        // Clear screen
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        // Set up matrices (shared by both terrain and contour rendering)
        const projectionMatrix = this.createProjectionMatrix();
        const modelViewMatrix = this.createModelViewMatrix();
        
        // Render terrain
        this.gl.useProgram(this.shaderProgram);
        
        // Get terrain uniform locations
        const projMatrixLocation = this.gl.getUniformLocation(this.shaderProgram, 'u_projectionMatrix');
        const mvMatrixLocation = this.gl.getUniformLocation(this.shaderProgram, 'u_modelViewMatrix');
        
        // Set terrain uniforms
        this.gl.uniformMatrix4fv(projMatrixLocation, false, projectionMatrix.elements);
        this.gl.uniformMatrix4fv(mvMatrixLocation, false, modelViewMatrix.elements);
        
        // Bind terrain vertex buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        const positionLocation = this.gl.getAttribLocation(this.shaderProgram, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0);
        
        // Bind terrain color buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        const colorLocation = this.gl.getAttribLocation(this.shaderProgram, 'a_color');
        this.gl.enableVertexAttribArray(colorLocation);
        this.gl.vertexAttribPointer(colorLocation, 3, this.gl.FLOAT, false, 0, 0);
        
        // Bind terrain index buffer and draw
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        const indexCount = (this.mapSize - 1) * (this.mapSize - 1) * 6;
        this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
        
        // Render contour lines
        if (this.lineShaderProgram && this.contourVertexBuffer && this.contourColorBuffer) {
            try {
                this.gl.useProgram(this.lineShaderProgram);
                
                // Get line uniform locations
                const lineProjMatrixLocation = this.gl.getUniformLocation(this.lineShaderProgram, 'u_projectionMatrix');
                const lineMvMatrixLocation = this.gl.getUniformLocation(this.lineShaderProgram, 'u_modelViewMatrix');
                
                // Set line uniforms
                this.gl.uniformMatrix4fv(lineProjMatrixLocation, false, projectionMatrix.elements);
                this.gl.uniformMatrix4fv(lineMvMatrixLocation, false, modelViewMatrix.elements);
                
                // Bind contour vertex buffer
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.contourVertexBuffer);
                const linePositionLocation = this.gl.getAttribLocation(this.lineShaderProgram, 'a_position');
                if (linePositionLocation >= 0) {
                    this.gl.enableVertexAttribArray(linePositionLocation);
                    this.gl.vertexAttribPointer(linePositionLocation, 3, this.gl.FLOAT, false, 0, 0);
                }
                
                // Bind contour color buffer
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.contourColorBuffer);
                const lineColorLocation = this.gl.getAttribLocation(this.lineShaderProgram, 'a_color');
                if (lineColorLocation >= 0) {
                    this.gl.enableVertexAttribArray(lineColorLocation);
                    this.gl.vertexAttribPointer(lineColorLocation, 3, this.gl.FLOAT, false, 0, 0);
                }
                
                // Get the vertex count from the buffer length
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.contourVertexBuffer);
                const bufferSize = this.gl.getBufferParameter(this.gl.ARRAY_BUFFER, this.gl.BUFFER_SIZE);
                const contourVertexCount = Math.floor(bufferSize / (3 * 4)); // 3 floats per vertex, 4 bytes per float
                
                if (contourVertexCount > 0 && contourVertexCount < 100000) { // Safety check
                    this.gl.drawArrays(this.gl.POINTS, 0, contourVertexCount);
                }
            } catch (error) {
                console.warn('Error rendering contour lines:', error);
            }
        }
    }
    
    private createProjectionMatrix(): Matrix4 {
        const fov = 45 * Math.PI / 180; // 45 degrees for more isometric feel
        const aspect = this.canvas.width / this.canvas.height;
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
    }
    
    private createModelViewMatrix(): Matrix4 {
        // Look-at matrix
        const eye = this.cameraPosition;
        const target = this.cameraTarget;
        const up = { x: 0, y: 1, z: 0 };
        
        const zAxis = this.normalize({
            x: eye.x - target.x,
            y: eye.y - target.y,
            z: eye.z - target.z
        });
        
        const xAxis = this.normalize(this.cross(up, zAxis));
        const yAxis = this.cross(zAxis, xAxis);
        
        return {
            elements: new Float32Array([
                xAxis.x, yAxis.x, zAxis.x, 0,
                xAxis.y, yAxis.y, zAxis.y, 0,
                xAxis.z, yAxis.z, zAxis.z, 0,
                -this.dot(xAxis, eye), -this.dot(yAxis, eye), -this.dot(zAxis, eye), 1
            ])
        };
    }
    
    private cross(a: Vector3, b: Vector3): Vector3 {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        };
    }
    
    private dot(a: Vector3, b: Vector3): number {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VibeCity();
});