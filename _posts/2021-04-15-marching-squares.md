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

### Biting Off Pieces
To fix this, we can decompose all blocked cells into [connected components](https://en.wikipedia.org/wiki/Component_(graph_theory)), which are induced subgraphs in which all vertices are connected through a series of edge traversals. Or in other words: a part of a graph that forms a contiguous shape. Dissecting our map graph into such components in the case of Pac-Man is rather easy[^1]: cells are either walkable or not (i.e., the cell contains a wall). Colour a cell black if it is walkable and blue if it is not. Cells belong to the same component as their neighbour if they share the same colour. Programmatically, this can be achieved using a simple [flood fill](https://en.wikipedia.org/wiki/Flood_fill) algorithm:

1. Select an arbitrary uncoloured pixel _p_.
2. Choose a random (but to this point unused) colour _c_.
3. Colour _p_ using _c_.
4. Propagate _c_ to all direct neighbours of _c_. For each neighbour of _c_, go to 3.
5. If there are uncoloured pixels left, go to 1.

But since we are working on the database, we will try to think less in a _one-at-a-time_ fashion, but use relations instead. For this, we will run one flood fill per pixel -- all at the same time. Instead of using colours, pixels will propagate a unique ID to their neighbours. If you look back at the schema for `environment.cells` (which, really, holds the pixels of the map) you will notice that they already have a serial primary key which works pretty well for this purpose:

<canvas id="components-base" class="center-image"></canvas>

So each cell will try and propagate their ID to their direct neighbours as illustrated above. For the sake of the reader's mental well-being, I will visualise the process on only one of the shapes. Differently coloured fills happen "at the same time". That does not necessarily mean "in parallel" (although the DBMS could do that), but rather "in the same pass". 

<canvas id="components-animation" class="center-image"></canvas>

Notice how smaller numbers do not prevail against their neighbours, resulting in very short floods. So we do not end up with exponential runtime, as we would if we flooded every ID through the entire component. The presented shape is conveniently laid out like a corridor, so the flooding only goes in one direction. But if it were to be an open space, the flooding would go on into every direction. Grouping and aggregating the results of the different passes leaves us with the following final result:

<canvas id="components-result" class="center-image"></canvas>

Now we only only need to deterministically select the ID that should be preferred over all other IDs in that list. I chose `MAX` to do that for me.

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
The above query gives us one ID (`component_id`) per cell. All cells with the same `component_id` belong to the same connected component. `THE`[^2] is an aggregation operator that expects a list of identical values and selects an arbitrary element from that list, i.e. `THE([42,42,42,42]) → 42`.

### Are We There Yet?!

Not quite! So far, we have only assigned each cell, or more specifically: each cell that is part of a wall, to a connected component. This is already a nice thing to have, as we could now easily determine a [bounding rectangle](https://en.wikipedia.org/wiki/Minimum_bounding_rectangle) for each piece of wall. Using those is a common way to speed up collision detection, as you can start a coarse-grained search for collisions between object's bounding boxes, before going for the pixel-exact collision checks. They go well with a glass of wine and a side of [Quadtree](https://en.wikipedia.org/wiki/Quadtree) -- a spatial index structure that many DBMSs come bundled with or can be enhanced with using an extension[^3].
But that is not what we were going for. We wanted to outline each wall piece, and for that we need another nice algorithm. Meet the [marching squares algorithm](https://en.wikipedia.org/wiki/Marching_squares)! Marching squares basically observes the edge of a shape through a pinhole (a 2×2 rectangle) and depending on what it sees, it moves the pinhole a bit up, down, to the left, or to the right, effectively marching around the shape in question. 

<canvas id="marching-squares-animation" class="center-image"></canvas>

Notice how we have multiple pinholes: one per connected component. They can all be moved at the same time and do not have to finish all at once. See how the yellow rectangle patiently waits for its red sibling to stop? That has nothing to do with their imminent collision; the yellow rectangle has simply finished its lap around its assigned shape already.

Assuming that each pixel it sees is either part of the shape (`■`) or not (`□`), that leaves us with 4² = 16 different images we can see through the pinhole, and for each we can define how the pinhole should be shifted.

<pre>
□□     ■■     □□     ■■
□□ →   □□ →   ■■ ←   ■□ →
   
□■     ■□     ■□     ■□
□□ →   □□ ↑   ■■ ↑   □■ ↑
   
□■     ■□     □■     □■
□■ ↓   ■□ ↑   ■■ ←   ■□ ←  

□□     □□     ■■     ■■
□■ ↓   ■□ ←   □■ ↓   ■■ ✕  
</pre>

We start out by putting the 16 possible images we can see through the pinhole in a relational fashion. Removing line breaks gives us a unique hash for every combination. The direction can be expressed in terms of an (x,y)-shift. E.g. `('□□□□',  1,  0)` is "when encountering `□□□□`, add 1 to the x-position of the pinhole and leave y-position be". I omit the 16th `■■■■`-state, as it is basically an error, implying that the pinhole is set directly onto a solid object, rather than its edge.

```sql
moves(hash, x_off, y_off) AS (
    VALUES
    ('□□□□',  1,  0), ('■■□□',  1,  0), ('□□■■', -1,  0), ('■■■□', 1,  0),
    ('□■□□',  1,  0), ('■□□□',  0, -1), ('■□■■',  0, -1), ('■□□■', 0, -1),
    ('□■□■',  0,  1), ('■□■□',  0, -1), ('□■■■',  -1, 0), ('□■■□', -1, 0),
    ('□□□■',  0,  1), ('□□■□', -1,  0), ('■■□■',  0,  1) 
),
```

We start out with a grid where we know the appropriate component ID for each cell (see above). We also add a bit of fluff to each side of the map. One empty cell, to be exact. This is required to properly walk around shapes that extend all the way to the edge of the map.

```sql
grid(x, y, passable, component_id) AS (
    WITH fluffed(x, y) AS (
        SELECT x,y FROM environment.cells 
        UNION -- using UNION we do not get duplicate cells, but just the extra cells outside of the original map's borders
        SELECT 
            c.x + xs.x,
            c.y + ys.y
        FROM 
            environment.cells AS c,
            generate_series(-1,1) AS xs(x),
            generate_series(-1,1) AS ys(y)
    )
    SELECT 
        f.x,
        f.y,
        cw.component_id IS NULL,
        cw.component_id
    FROM 
        fluffed AS f 
        LEFT JOIN environment.compound_walls AS cw
          ON (cw.x, cw.y) = (f.x, f.y)
),
```

For each component we select one coordinate to start from. In general, you can choose an arbitrary position to start. But here I chose the bottom-right-most cell of each component. Marching squares has a bit of an issue with bodies with holes in them. Depending on what your offsets define and where you start, you will either get the shape describing the inside or the outside of the body. The only body with a hole in it in the case of Pac-Man is the outer wall, confining the map. I would like the inner shape of that, hence the starting point.
```sql
start_coordinates(x, y, component_id) AS (
    SELECT DISTINCT ON (component_id)
        x, 
        y, 
        component_id
    FROM
        grid
    WHERE 
        component_id IS NOT NULL
    ORDER BY 
        component_id, y DESC, x DESC
),
```

Now we would like to make each starting coordinate into a square. To do so, we only need to add the three adjacent cells to each starting point. We will re-use these offsets quite a bit later on, so we put them in their own CTE.

```sql
square_offsets(x, y) AS (
    SELECT 
        xs.x, 
        ys.y
    FROM 
        generate_series(0,1) AS xs(x), 
        generate_series(0,1) AS ys(y)
),
```

And off we go! Marching squares works as described:

1. at the position of all pinholes (we have one per component) span a 2×2 rectangle (`squares`)
2. hash what you are seeing through the pinholes (`hashes`)
3. join the constructed hashes on the possible hashes from `moves`
4. select the next position for each pinhole by applying the offsets from `moves` we just found

Each pinhole stops moving if it would move onto its starting position, thus producing no new row for the CTE. If all pinholes have stopped moving, no new rows are produced and the recursion stops.

```sql
marching_squares↺(iteration, x, y, component_id, start) AS (
    SELECT 
        1,
        x, 
        y, 
        component_id, 
        (x, y)
    FROM 
        start_coordinates
    UNION ALL 
    (
    WITH
    squares(iteration, origin_x, origin_y, x, y, passable, component_id, start) AS (
        WITH coordinates(iteration, component_id, origin_x, origin_y, neighbour_x, neighbour_y, start) AS (
            SELECT
                ms.iteration    AS iteration,
                ms.component_id AS component_id,
                ms.x            AS origin_x,
                ms.y            AS origin_y,
                ms.x - so.x     AS neighbour_x, -- using minus here is important to match the resulting squares with the hashes! (origin needs to be lower right coordinate of the square)
                ms.y - so.y     AS neighbour_y,
                ms.start        AS start
            FROM   
                marching_squares↺ AS ms,
                square_offsets    AS so
        )
        SELECT 
            c.iteration       AS iteration,
            c.origin_x        AS origin_x,
            c.origin_y        AS origin_y,
            grid.x            AS x,
            grid.y            AS y,
            grid.passable     AS passable,
            c.component_id    AS component_id,
            c.start           AS start
        FROM 
            coordinates AS c
            JOIN grid 
              ON (c.neighbour_x, c.neighbour_y) = (grid.x, grid.y)   
    ),
    hashes(iteration, origin_x, origin_y, component_id, hash, start) AS (
        SELECT 
            iteration,
            origin_x,
            origin_y,
            THE(component_id),
            string_agg(CASE WHEN passable THEN '□' ELSE '■' END ,'' ORDER BY y,x), -- yes, y,x is correct
            start
        FROM 
            squares
        GROUP BY 
            origin_x, origin_y, start, iteration
    )
    SELECT 
        hashes.iteration + 1        AS iteration,
        grid.x                      AS x,
        grid.y                      AS y,
        hashes.component_id         AS component_id,
        hashes.start                AS start
    FROM 
        hashes
        JOIN moves
          ON hashes.hash = moves.hash 
        JOIN grid
          ON (hashes.origin_x + moves.x_off, hashes.origin_y + moves.y_off) = (grid.x, grid.y)
    WHERE 
        (grid.x, grid.y) <> hashes.start
    )
),
```

Now just a bit of cleanup and we are done. As we stopped each pinhole before going to its starting position, we need to close the shape "manually" by adding each pinhole's starting position as its final position as well:

```sql
closed(component_id, iteration, x, y) AS (
    SELECT 
        component_id,
        iteration,
        x,
        y
    FROM 
        marching_squares↺ AS ms
    UNION ALL
    SELECT 
        component_id,
        (SELECT MAX(iteration) + 1 FROM marching_squares↺), -- this guarantees that the closing line will always come last in the following ordering
        x,
        y
    FROM 
        marching_squares↺ AS ms
    WHERE 
        iteration = 1
),
```

That's it. The result is a series of positions the pinholes assumed when marching around each shape which an sorting order defined by `iteration`. Dumping these into a regular old drawing library as a list of `lineTo(x,y)`-instructions would result in the outlines for our walls. 

But I have a little bit of icing left for this cake: marching squares actually produces too many instructions per wall. To be exact, it yields every encircled points in the following image:


<canvas id="too-many-instructions" class="center-image"></canvas>

But since we will be drawing straight lines between points, we actually only need the position of each corner from which we change direction:

<canvas id="fewer-instructions" class="center-image"></canvas>

I'll admit, this probably falls into the realm of premature optimisation, as it saves us only a few points for our use case at hand. But scaled up to much larger maps and with the goal in mind to do as much heavy lifting on the DBMS and slim down the clients as much as possible, let's do it!
It's super easy anyway: for each point we look at the the point preceding and succeeding it. If they they all share either their x- or they x-position, they are all part of a straight line and the point we are looking at is superfluous and can be marked as such. 


```sql
reduced(component_id, iteration, x, y, superfluous) AS (
    SELECT 
        component_id,
        iteration,
        x,
        y,
        COALESCE(
            LEAD(x) OVER(PARTITION BY component_id ORDER BY iteration) = x AND LAG(x) OVER(PARTITION BY component_id ORDER BY iteration) = x
            OR 
            LEAD(y) OVER(PARTITION BY component_id ORDER BY iteration) = y AND LAG(y) OVER(PARTITION BY component_id ORDER BY iteration) = y
        , FALSE) -- first and last piece will be NULL
          AS superfluous
    FROM 
        closed
)
```

For the final step (pinky promise!) we select the relevant information and convert them into a format that is easily understandable for our render engine:

```sql
SELECT 
    component_id,
    array_agg(array[x,y] ORDER BY iteration)
FROM 
    reduced
WHERE 
    NOT superfluous
GROUP BY 
    component_id
);
```

And there we have it. Beautiful, outlined walls as we know and love them: 

<canvas id="final-result" class="center-image"></canvas>


The result for one map I actually use for Pac-Man looks like this:

<pre>
 wall |                                                    coordinates                                                    
------+-------------------------------------------------------------------------------------------------------------------
   16 | { {0,6},{0,10},{11,10},{11,0},{0,0},{0,6} }
   28 | { {2,7},{2,8},{3,8},{3,7},{2,7} }
   34 | { {3,3},{3,4},{4,4},{4,2},{2,2},{2,3},{3,3} }
   46 | { {4,5},{3,5},{3,6},{5,6},{5,5},{4,5} }
   54 | { {5,3},{5,4},{6,4},{6,1},{10,1},{10,4},{9,4},{9,6},{10,6},{10,9},{1,9},{1,6},{2,6},{2,4},{1,4},{1,1},{5,1},{5,3} }
   68 | { {6,7},{4,7},{4,8},{7,8},{7,7},{6,7} }
   74 | { {7,3},{7,4},{8,4},{8,3},{9,3},{9,2},{7,2},{7,3} }
   76 | { {7,5},{6,5},{6,6},{8,6},{8,5},{7,5} }
   83 | { {8,2},{7,2},{7,4},{8,4},{8,3},{9,3},{9,2},{8,2} }
   88 | { {8,7},{8,8},{9,8},{9,7},{8,7} }
  110 | { {10,9},{1,9},{1,6},{2,6},{2,4},{1,4},{1,1},{5,1},{5,4},{6,4},{6,1},{10,1},{10,4},{9,4},{9,6},{10,6},{10,9} }
(11 rows)
</pre>

This is what a client will receive when connecting to the Pac-Man-DB and asking for the map shape. No brains for the client required, just connecting dots. The full code with a bit of context can be found [in the project's GitHub repository](https://github.com/ogrady/PacmanSQL/blob/9f41383e4c262cf905d785a6ea7cb30e40f3261b/backend/src/db/sql/environment.sql).

<script type="module">
    import * as G from "{{ site.baseurl }}{% link assets/js/grid.js %}";

    window.onload = () => {
        let grid;
        const ticker = new G.Ticker(1000);
        const gridSize = [300, 300];
        const mapSize = [6,6];
        const canvasSize = [mapSize[0] * 50, mapSize[1] * 50];
        const blockSize = G.divideGrid(canvasSize, mapSize);
        ticker.start();


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

    // COMPONENTS
        grid = G.create("components-base", gridSize, mapSize);
        individualBlocks.map(w => grid.drawWall(w));
        [
            [2,1,"1"], [3,1,"2"], [4,1,"3"], [4,2,"4"],
            [1,3,"5"], [2,3,"6"], [1,4,"7"], [2,4,"8"]
        ].map(([x,y,s]) => grid.labelCell(x, y, s));


        // ANIMATION
        grid = G.create("components-animation", gridSize, mapSize);
        let animation = new G.Animation(grid, {base: g => {
            g.showGrid([6,6]);
            individualBlocks.map(w => g.drawWall(w));
        }});

        animation.frames.push(            
            // 1
            g => {
                [[3,1,"2"], [4,1,"3"], [4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[2,1,"1"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "green"}));
            },
            () => {},

            // 2
            g => {
                [[2,1,"1"], [4,1,"3"], [4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[3,1,"2"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "red"}));
            },
            g => {
                [[4,1,"3"], [4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[2,1,"2"],[3,1,"2"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "red"}));
            },
            () => {},

            // 3
            g => {
                [[2,1,"1"], [3,1,"2"], [4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[4,1,"3"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "teal"}));
            },
            g => {
                [[2,1,"1"], [4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[3,1,"3"],[4,1,"3"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "teal"}));
            },
            g => {
                [[4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[2,1,"3"], [3,1,"3"],[4,1,"3"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "teal"}));
            },
            () => {},

            // 4
            g => {
                [[2,1,"1"], [3,1,"2"], [4,1,"3"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "yellow"}));
            },
            g => {
                [[2,1,"1"], [3,1,"2"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[4,1,"4"], [4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "yellow"}));
            },
            g => {
                [[2,1,"1"]].map(([x,y,s]) => g.labelCell(x, y, s));
                [[3,1,"4"], [4,1,"4"],[4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "yellow"}));
            },
            g => {
                [[2,1,"4"], [3,1,"4"], [4,1,"4"],[4,2,"4"]].map(([x,y,s]) => g.labelCell(x, y, s, {fillStyle: "yellow"}));
            },
            () => {},
        );
        ticker.register(animation);

        grid = G.create("components-result", gridSize, mapSize);
        individualBlocks.map(w => grid.drawWall(w));
        [
            [2,1,"1,2,3,4"], [3,1,"2,3,4"], [4,1,"3,4"], [4,2,"4"],
        ].map(([x,y,s]) => grid.labelCell(x, y, s, {font: "13px Arial"}));

        grid = G.create("marching-squares-animation", gridSize, mapSize);
        animation = new G.Animation(grid, {base: g => {
            g.showGrid([6,6]);
            individualBlocks.map(w => g.drawWall(w));
        }});
        animation.frames.push( 
            g => { g.highlightRect(4,2,2,2, {strokeStyle: "red"}), g.highlightRect(2,4,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(4,1,2,2, {strokeStyle: "red"}), g.highlightRect(2,3,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(4,0,2,2, {strokeStyle: "red"}), g.highlightRect(2,2,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(3,0,2,2, {strokeStyle: "red"}), g.highlightRect(1,2,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(2,0,2,2, {strokeStyle: "red"}), g.highlightRect(0,2,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(1,0,2,2, {strokeStyle: "red"}), g.highlightRect(0,3,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(1,1,2,2, {strokeStyle: "red"}), g.highlightRect(0,4,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(2,1,2,2, {strokeStyle: "red"}), g.highlightRect(1,4,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(3,1,2,2, {strokeStyle: "red"}), g.highlightRect(2,4,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(3,2,2,2, {strokeStyle: "red"}), g.highlightRect(2,4,2,2, {strokeStyle: "yellow"}) },
            g => { g.highlightRect(4,2,2,2, {strokeStyle: "red"}), g.highlightRect(2,4,2,2, {strokeStyle: "yellow"}) },
            g => {}
        );
        ticker.register(animation);

        grid = G.create("too-many-instructions", gridSize, mapSize);
        individualBlocks.map(w => grid.drawWall(w));
        [[2,1], [2,2], [3,2], [4,2], [4,3], [5,3], [5,2], [5,1], [4,1], [3,1]].map(([x,y]) => grid.highlightPosition(x,y, {strokeStyle: "red"}));
        [[1,3], [1,4], [1,5], [2,5], [3,5], [3,4], [3,3], [2,3]].map(([x,y]) => grid.highlightPosition(x,y, {strokeStyle: "yellow"}));
        
        grid = G.create("fewer-instructions", gridSize, mapSize);
        individualBlocks.map(w => grid.drawWall(w));
        [[2,1], [2,2], [4,2], [4,3], [5,3], [5,1]].map(([x,y]) => grid.highlightPosition(x,y, {strokeStyle: "red"}));
        [[1,3], [1,5], [3,5], [3,3]].map(([x,y]) => grid.highlightPosition(x,y, {strokeStyle: "yellow"}));

        grid = G.create("final-result", gridSize, mapSize);
        outlinedBlocks.map(w => grid.drawWall(w));
        
    }
</script>

<!--
Given a function ⁅f⁆ of a real variable ⁅x⁆ and an interval ⁅[a, b]⁆ of the real line, the **definite integral**

⁅∫_a^b f(x) ⅆx⁆

can be interpreted informally as the signed area of the region in the ⁅xy⁆-plane that is bounded by the graph of ⁅f⁆, the ⁅x⁆-axis and the vertical lines ⁅x = a⁆ and ⁅x = b⁆.-->
<hr>

[^1]: Connected components can be quite ambiguous when you are dealing with different terrain types and different entity types that can travel on different terrains. Fish and ducks will consider different terrain types passable and therefore form different connected components.

[^2]: [Simon P. Jones and Philip Wadler. "Comprehensive Comprehensions"](https://dl.acm.org/doi/10.1145/1291201.1291209).

[^3]: Going from 2D to 3D you would have [bounding _boxes_](https://en.wikipedia.org/wiki/Minimum_bounding_box) and [_Octrees_](https://de.wikipedia.org/wiki/Octree) instead.