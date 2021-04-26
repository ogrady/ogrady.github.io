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
When looking at the walls in the original Pac-Man, you will notice the walls are not solid, but only outlined.

![](https://upload.wikimedia.org/wikipedia/en/5/59/Pac-man.png){: .center-image }
Image source: [Wikipedia](https://en.wikipedia.org/wiki/Pac-Man#/media/File:Pac-man.png).
{: .caption }

With our current data structure, we can only visualise walls very plainly as adjacent blocks that are either outlined, which will show the border in-between each pair of adjacent blocks, or fill them completely to look more like a solid wall, but not quite as nice as in the original game.

<div class="center">
<canvas id="canvas-boring-outlined" ></canvas>
<canvas id="canvas-boring-filled" ></canvas>
</div>

### Baby Steps
To fix this, we can decompose all blocked cells into [connected components](https://en.wikipedia.org/wiki/Component_(graph_theory)), which are induced subgraphs in which all vertices are connected through a series of edge traversals. Or in other words: a part of a graph that forms a contiguous shape. Dissecting our map graph into such components in the case of Pac-Man is rather easy[^1]: cells are either walkable or not (ie, the cell contains a wall). Colour a cell black if it is walkable and blue if it is not. Cells belong to the same component as their neighbour if they share the same colour. Programmatically, this can be achieved using a simple [flood fill](https://en.wikipedia.org/wiki/Flood_fill) algorithm:

1. Select an arbitrary uncoloured pixel _p_.
2. Choose a random (but to this point unused) colour _c_.
3. Colour _p_ using _c_.
4. Propagate _c_ to all direct neighbours of _c_. For each neighbour of _c_, go to 3.
5. If there are uncoloured pixels left, go to 1.

But since we are working on the database, we will try to think less in a _one-at-a-time_ fashion, but use relations instead. For this, we will run one flood fill per pixel -- all at the same time. Instead of using colours, pixels will propagate a unique ID to their neighbours. If you look back at the schema for `environment.cells` (which, really, holds the pixels of the map) you will notice that they already have a serial primary key which works pretty well for this purpose.
So each cell will try and propagate their ID to their direct neighbours as illustrated above.
The results of all those flood fills leaves us with one list of IDs for each cell, describing which IDs have been flooded over the cell in question. Now we only only need to deterministically select the ID that should be preferred over all other IDs in that list. I chose `MAX` to do that for me.

```sql
CREATE VIEW environment.compound_walls(cell_id, x, y, component_id) AS (
    WITH RECURSIVE 
    comps↺(cell_id, component_id) AS (
        SELECT 
            id AS cell_id,
            id AS component_id
        FROM 
            environment.cells
        WHERE 
            NOT passable
        UNION
        (
            WITH comps AS (TABLE comps↺) -- hack to work around restriction to not use aggregates in recursive term
            TABLE comps 
            UNION ALL
            SELECT
                cn.this_id,
                MAX(n_comps.component_id)
            FROM 
                comps
                JOIN environment.cell_neighbourhoods AS cn 
                  ON comps.cell_id = cn.this_id
                JOIN environment.cells AS c 
                  ON cn.neighbour_id = c.id 
                JOIN comps AS n_comps
                  ON cn.neighbour_id = n_comps.cell_id
            WHERE 
                NOT c.passable
            GROUP BY 
                cn.this_id
        )
    ) 
    SELECT 
        comps.cell_id,
        THE(c.x),
        THE(c.y),
        MAX(comps.component_id)
    FROM 
        comps↺ AS comps 
        JOIN environment.cells AS c 
          ON comps.cell_id = c.id
    GROUP BY 
        comps.cell_id
);
```
The above query gives us one ID (`component_id`) per cell. All cells with the same `component_id` belong to the same connected component.

<canvas id="canvas1" class="center-image"></canvas>

### Are We There Yet

Not quite! So far, we have only assigned each cell, or more specifically: each cell that is part of a wall, to a connected component. This is already a nice thing to have, as we could now easily determine a [bounding box](https://en.wikipedia.org/wiki/Minimum_bounding_box) for each piece of wall. Using those is a common way to speed up collision detection, as you can make coarse grained search for collisions between object's bounding boxes, before going for the pixel-exact collision checks. They go well with a glass of wine and a side of [Quadtree](https://en.wikipedia.org/wiki/Quadtree) -- a spatial index structure that many DBMSs come bundled with or can be enhanced with using an extension.
But that is not what we were going for. We wanted to outline each wall piece, and for that we need another nice algorithm. Meet the [marching squares algorithm](https://en.wikipedia.org/wiki/Marching_squares)! Marching squares basically observes the edge of a shape through a pinhole and depending on what it sees, it moves the pinhole a bit up, down, to the left, or to the right, effectively moving around the shape in question. The pinhole is in fact a 2×2 rectangle. Assuming that each pixel it sees is either part of the shape (`■`) or not (`□`), that leaves us with 4^2=16 different images we can see through the pinhole, and for each we can define how the pinhole should be shifted.

```
□□     ■■     □□     ■■
□□ →   □□ →   ■■ ←   ■□ →
   
□■     ■□     ■□     ■□
□□ →   □□ ↑   ■■ ↑   □■ ↑
   
□■     ■□     □■     □■
□■ ↓   ■□ ↑   ■■ ←   ■□ ←  

□□     □□     ■■     ■■
□■ ↓   ■□ ←   □■ ↓   ■■ ✕  
```


<script type="module">
    import * as G from "{{ site.baseurl }}{% link assets/js/grid.js %}";

    window.onload = () => {
        let grid;
        const mapSize = [6,6];
        const canvasSize = [mapSize[0] * 50, mapSize[1] * 50];
        const blockSize = G.divideGrid(canvasSize, mapSize);

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

        grid = G.create("canvas-boring-outlined", canvasSize, mapSize);
        individualBlocks.map(w => grid.drawWall(w));

        grid = G.create("canvas-boring-filled", canvasSize, mapSize);
        solidBlocks.map(w => grid.fillRectangleWall(w));






        const grd = G.create("canvas1", [300,300], [6,6]);
        //grid.showGrid("canvas1", canvasSize, mapSize);
        
        [
            [[2,1], [2,2], [3,2], [3,1]],
            [[3,1], [3,2], [4,2], [4,1]],
            [[4,1], [4,2], [5,2], [5,1]],
            [[4,2], [4,3], [5,3], [5,2]],

            [[1,3], [2,3], [2,4], [1,4]],
            [[2,3], [3,3], [3,4], [2,4]],
            [[1,4], [2,4], [2,5], [1,5]],
            [[2,4], [3,4], [3,5], [2,5]],
        ].map(w => grd.drawWall(w, blockSize));

        var ctx = canvas.getContext("2d");
        ctx.font = "30px Arial";
        ctx.fillText("Hello World", 10, 50);

        G.showGrid("canvas2", canvasSize, mapSize);
        
        outlinedBlocks.map(w => G.drawWall("canvas2", w, blockSize));
    }
</script>

<!--
Given a function ⁅f⁆ of a real variable ⁅x⁆ and an interval ⁅[a, b]⁆ of the real line, the **definite integral**

⁅∫_a^b f(x) ⅆx⁆

can be interpreted informally as the signed area of the region in the ⁅xy⁆-plane that is bounded by the graph of ⁅f⁆, the ⁅x⁆-axis and the vertical lines ⁅x = a⁆ and ⁅x = b⁆.-->

<canvas id="canvas1" class="center-image"></canvas>
<canvas id="canvas2"></canvas>


[^1]: Connected components can be quite ambiguous when you are dealing with different terrain types and different entity types that can travel on different terrains. Fish and ducks will consider different terrain types passable and therefore form different connected components.