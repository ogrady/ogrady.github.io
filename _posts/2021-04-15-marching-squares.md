---
layout: post
title:  "Maps in SQL"
date:   2021-04-15 22:07:00 +0200
categories: jekyll update
---
## Data Definition
Maps for Pac-Man are pleasantly simple compared to modern games: the playing field consists of a two-dimensional regular grid. Cells can either be stepped on by actors (= Pac-Man or any of the ghosts) or not. A cell can hold a regular pellet, a power pellet, a fruit, or nothing.
That gives us the following schema for the map:

```sql
CREATE TABLE environment.item_types(
    id   SERIAL PRIMARY KEY,
    name TEXT
);

INSERT INTO environment.item_types(name) (VALUES
    ('pellet'),
    ('power pellet'),
    ('cherry')
);

CREATE TABLE environment.cells(
    id       SERIAL PRIMARY KEY,
    x        INT, 
    y        INT, 
    passable BOOLEAN, 
    content  INT DEFAULT 1, -- pellet
    UNIQUE(x, y),
    FOREIGN KEY(content) REFERENCES environment.item_types(id)
);
```

We could stop at this point, as this gives us all the desired functionality to navigate our actors and determine collisions with the environment. But we will go for a little extra fun.

## Smooth Walls
When looking at the walls in the original Pac-Man, you will notice the walls are only outlined.

![](https://upload.wikimedia.org/wikipedia/en/5/59/Pac-man.png){: .center-image }
Image source: [Wikipedia](https://en.wikipedia.org/wiki/Pac-Man#/media/File:Pac-man.png).
{: .caption }

With our current data structure, we can only visualise walls very plainly as adjacent blocks that are either outlined, which will show the border inbetween each pair of adjacent blocks, or fill them completely to look more like a solid wall, but not quite as nice as in the original game.

<div class="center">
<canvas id="canvas-boring-outlined" ></canvas>
<canvas id="canvas-boring-filled" ></canvas>
</div>

To fix this, we can make use of [connected components](https://en.wikipedia.org/wiki/Component_(graph_theory)), which is an induced subgraph in which each vertex contained in that subgraph .

<script type="module">
    import * as grid from "{{ site.baseurl }}{% link assets/js/grid.js %}";

    window.onload = () => {
        const mapSize = [6,6];
        const canvasSize = [mapSize[0] * 50, mapSize[1] * 50];
        const blockSize = grid.divideGrid(canvasSize, mapSize);

        const individualBlocks = [
            [[2,1], [2,2], [3,2], [3,1]],
            [[3,1], [3,2], [4,2], [4,1]],
            [[4,1], [4,2], [5,2], [5,1]],
            [[4,2], [4,3], [5,3], [5,2]],

            [[1,3], [2,3], [2,4], [1,4]],
            [[2,3], [3,3], [3,4], [2,4]],
            [[1,4], [2,4], [2,5], [1,5]],
            [[2,4], [3,4], [3,5], [2,5]],
        ];

        const outlinedBlocks = [
            [[2,1], [5,1], [5,3], [4,3], [4,2], [2,2]],

            [[1,3], [3,3], [3,5], [1,5]]
        ];

        const solidBlocks = [
            [[2,1]],
            [[3,1]],
            [[4,1]],
            [[4,2]],

            [[1,3]],
            [[2,3]],
            [[1,4]],
            [[2,4]],
        ];

        grid.showGrid("canvas-boring-outlined", canvasSize, mapSize);
        individualBlocks.map(w => grid.drawWall("canvas-boring-outlined", w, blockSize));

        grid.showGrid("canvas-boring-filled", canvasSize, mapSize);
        solidBlocks.map(w => grid.fillRectangleWall("canvas-boring-filled", w, blockSize));





        grid.showGrid("canvas1", canvasSize, mapSize);
        
        [
            [[2,1], [2,2], [3,2], [3,1]],
            [[3,1], [3,2], [4,2], [4,1]],
            [[4,1], [4,2], [5,2], [5,1]],
            [[4,2], [4,3], [5,3], [5,2]],

            [[1,3], [2,3], [2,4], [1,4]],
            [[2,3], [3,3], [3,4], [2,4]],
            [[1,4], [2,4], [2,5], [1,5]],
            [[2,4], [3,4], [3,5], [2,5]],
        ].map(w => grid.drawWall("canvas1", w, blockSize));

        grid.showGrid("canvas2", canvasSize, mapSize);
        
        outlinedBlocks.map(w => grid.drawWall("canvas2", w, blockSize));
    }
</script>
Given a function ⁅f⁆ of a real variable ⁅x⁆ and an interval ⁅[a, b]⁆ of the real line, the **definite integral**

⁅∫_a^b f(x) ⅆx⁆

can be interpreted informally as the signed area of the region in the ⁅xy⁆-plane that is bounded by the graph of ⁅f⁆, the ⁅x⁆-axis and the vertical lines ⁅x = a⁆ and ⁅x = b⁆.

<canvas id="canvas1" class="center-image"></canvas>
<canvas id="canvas2"></canvas>
