export const divideGrid = ([canvasWidth, canvasHeight], [mapWidth, mapHeight]) => [Math.floor(canvasWidth / mapWidth), Math.floor(canvasHeight / mapHeight)];

export const create = (canvasId, pixelSize, mapSize) => new Grid(canvasId).resize(pixelSize).showGrid(mapSize);

export class Ticker {
    constructor(delay) {
        this.listeners = [];
        this.delay = delay;
    }

    start() {
        this._tick();
    }

    _tick() {
        this.listeners.map(l => l.onTick());
        setTimeout(this._tick.bind(this), this.delay);
    }

    register(listener) {
        this.listeners.push(listener);
    }
}

export class Animation  {
    constructor(grid, {repeat = true, base = undefined} = {}) {
        this.grid = grid;
        this.repeat = repeat;
        this.frames = [];
        this.frame = 0;
        this.base = base;
    }

    onTick() {
        const renderer = this.frames[this.frame];
        this.frame = this.repeat ? (this.frame + 1) % this.frames.length : Math.min(this.frame + 1, this.frames.length);
        if(renderer) {
            if(this.base) {
                this.base(this.grid);    
            }
            renderer(this.grid);
        }
    }
}

export class Grid {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(this.canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.blockSize = [1,1];  
    }

    resize([width, height]) {
        this.ctx.canvas.width = width;
        this.ctx.canvas.height = height;
        return this;
    }

    getCanvasSize() {
        return [this.ctx.canvas.width, this.ctx.canvas.height];
    }

    showGrid(mapSize, {backgroundStyle = "#000", gridStyle = "#222", lineWidth = 1} = {}) {
        const [canvasWidth, canvasHeight] = this.getCanvasSize();
        const [mapWidth, mapHeight] = mapSize;
        this.blockSize = divideGrid(this.getCanvasSize(), mapSize);
        const [blockWidth, blockHeight]  = this.blockSize;

        // background
        //this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        this.ctx.fillStyle = backgroundStyle;
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // grid
        this.ctx.lineWidth = lineWidth;
        this.ctx.strokeStyle = gridStyle;
        this.ctx.beginPath();
        for(let y = 0; y < mapHeight; y++) {
            for(let x = 0; x < mapWidth; x++) {
                this.ctx.rect(x * blockWidth, y * blockHeight, blockWidth, blockHeight);
            }
        }
        this.ctx.stroke();
        return this;
    }

    _path(points, consumer) {
        const [blockWidth, blockHeight] = this.blockSize;
        points = points.map(([x,y]) => [x*blockWidth, y*blockHeight]);
        const [sx, sy] = points[0];
        this.ctx.moveTo(sx, sy);
        this.ctx.beginPath();        
        points.map(consumer);
        this.ctx.closePath();
        this.ctx.stroke();
        return this;        
    }

    drawWall(points, {wallStyle = "#4287f5", wallWidth = 5} = {}) {
        this.ctx.strokeStyle = wallStyle;
        this.ctx.lineWidth = wallWidth;
        return this._path(points, ([x,y]) => this.ctx.lineTo(x,y));
    }

    fillRectangleWall(points, {wallStyle = "#4287f5", wallWidth = 5} = {}) {
        const [blockWidth, blockHeight] = this.blockSize;
        this.ctx.fillStyle = wallStyle;
        this.ctx.lineWidth = wallWidth;
        return this._path(points, ([x,y]) => this.ctx.fillRect(x, y, blockWidth, blockHeight));
    }

    labelCell(x, y, text, {fillStyle = "white", font = "20px Arial"} = {}) {
        const [blockWidth, blockHeight] = this.blockSize;
        this.ctx.font = font;
        this.ctx.fillStyle = fillStyle;
        const {width} = this.ctx.measureText(text);
        this.ctx.fillText(text, blockWidth * x + blockWidth/2 - width/2, blockHeight * y + blockHeight/2 );
    }

    highlightRect(x, y, w, h, {strokeStyle = "red", lineWidth = 2} = {}) {
        const [blockWidth, blockHeight] = this.blockSize;
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.rect(x * blockWidth, y * blockHeight, w * blockWidth, h * blockHeight);
        this.ctx.stroke();
    }

    highlightPosition(x, y, {strokeStyle = "red", lineWidth = 2, size = 5} = {}) {
        const [blockWidth, blockHeight] = this.blockSize;
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.lineWidth = lineWidth;
        this.ctx.beginPath();
        this.ctx.arc(x * blockWidth, y * blockHeight, size, size, 4 * Math.PI);
        this.ctx.stroke();
    }
}
