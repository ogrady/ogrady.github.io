export const divideGrid = ([canvasWidth, canvasHeight], [mapWidth, mapHeight]) => [Math.floor(canvasWidth / mapWidth), Math.floor(canvasHeight / mapHeight)];

export function showGrid(canvasId, 
                 canvasSize = [400, 400], 
                 mapSize = [6, 6],
                 backgroundStyle = "#000",
                 gridStyle = "#222") 
{
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const [canvasWidth, canvasHeight] = canvasSize;
    const [mapWidth, mapHeight] = mapSize;
    const [blockWidth, blockHeight] = divideGrid(canvasSize, mapSize);

    ctx.canvas.width = canvasWidth;
    ctx.canvas.height = canvasHeight;

    // background
    ctx.fillStyle = backgroundStyle;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // grid
    ctx.strokeStyle = gridStyle;
    ctx.beginPath();
    for(let y = 0; y < mapHeight; y++) {
        for(let x = 0; x < mapWidth; x++) {
            ctx.rect(x * blockWidth, y * blockHeight, blockWidth, blockHeight);
        }
    }
    ctx.stroke();
}

export function drawWall(canvasId, points, blockSize, wallStyle = "#4287f5", wallWidth = 5) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const [blockWidth, blockHeight] = blockSize;

    points = points.map(([x,y]) => [x*blockWidth, y*blockHeight]);

    ctx.strokeStyle = wallStyle;
    ctx.lineWidth = wallWidth;
    ctx.beginPath();
    const [sx, sy] = points.shift();
    ctx.moveTo(sx, sy);
    for(const [x,y] of points) {
        ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.stroke();
}

export function fillRectangleWall(canvasId, points, blockSize, wallStyle = "#4287f5", wallWidth = 5) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    const [blockWidth, blockHeight] = blockSize;

    points = points.map(([x,y]) => [x*blockWidth, y*blockHeight]);

    ctx.fillStyle = wallStyle;
    ctx.lineWidth = wallWidth;
    ctx.beginPath();
    points.map(([x,y]) => ctx.fillRect(x, y, blockWidth, blockHeight))
    ctx.stroke();
}