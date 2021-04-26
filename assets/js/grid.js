export const divideGrid = ([canvasWidth, canvasHeight], [mapWidth, mapHeight]) => [Math.floor(canvasWidth / mapWidth), Math.floor(canvasHeight / mapHeight)];

export const create = (canvasId, pixelSize, mapSize) => new Grid(canvasId).resize(pixelSize).showGrid(mapSize);

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

    showGrid(mapSize, {backgroundStyle = "#000", gridStyle = "#222"} = {}) {
        const [canvasWidth, canvasHeight] = this.getCanvasSize();
        const [mapWidth, mapHeight] = mapSize;
        this.blockSize = divideGrid(this.getCanvasSize(), mapSize);
        const [blockWidth, blockHeight]  = this.blockSize;

        // background
        this.ctx.fillStyle = backgroundStyle;
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // grid
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

    labelCell(x, y, text, {strokeStyle = "red", font = "20px Arial"} = {}) {
        const [blockWidth, blockHeight] = this.blockSize;
        this.ctx.font = font;
        this.ctx.fillStyle = strokeStyle;
        const {width} = this.ctx.measureText(text);
        this.ctx.fillText(text, blockWidth * x + blockWidth/2 - width/2, blockHeight * y + blockHeight/2 );
    }
}
