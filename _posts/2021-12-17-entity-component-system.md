---
layout: post
title:  "Entity Component System and SQL"
date:   2021-12-17 17:00:00 +0200
categories: jekyll update
---

## The Yawning Gash
If you have ever dabbled in video game development in the past ten or twenty years, chances are you used an object oriented programming language to do so. Hell, my first attempts at creating a game were done using the [jMonkey engine][jmonkey]. And one can easily see why OOP is popular for game development: it is very convenient to summarise data into semantic classes:

```java
public class Position {
    public int x;
    public int y;

    public Position(int x, int y) {
        this.x = x;
        this.y = y;
    }
}
```

They are perfect to group common functionality together in base classes and specialise them in subclasses:


```java
public abstract class Monster {
    protected int health;
    public final Position position;

    public Monster(int health, Position position) {
        this.health = health;
        this.position = position;
    }
}

public class Skeleton extends Monster {
    public Skeleton(Position position) {
        super(10, position);
    }
}

public class Zombie extends Monster {
    public Zombie(Position position) {
        super(8, position);
    }
}

``` 

and the idea of having all information about a game object stowed away in its own little scope to manage them seperately sounds just extremely neat!

```java
ArrayList<Monster> monsters = new ArrayList<>();

monsters.add(new Skeleton(new Position(0, 3)));
monsters.add(new Zombie(new Position(42, 32)));

for(Monster m : monsters) {
    m.x += 1; // move all monsters to the right
}

```

So the idea of marrying video games and OOP sounds just perfect. SQL on the other hand lacks cool OOP mechanisms such as [inheritance][impedance]. So it is completely unusable for video game logic. Right?

Actually, inheritance can give you severe headaches when you have a large variety of classes where each class differs a little bit. Think: in addition to your regular unarmed `Skeleton` and `Zombie` you want to have a variant of each that wields an axe. So you start adding `SkeletonWithAxe` and `ZombieWithAxe`. This leads to an explosion of classes and suddenly it becomes very annoying to add in new weapons and enemy types. This issue can be solved using the [decorator pattern][decorator] in OOP. But there is also a related pattern that is mostly used within the gaming industry, called the _entity component system_ (ECS) where inheritance is dropped almost completely in favour of a more modular approach.

## Entity Component System
Within an ECS, all "things" you encounter, like our enemies above, are _entities_. An entity can be reduced to a single unique identifier (can you smell the primary key already?). _Components_ are everything that can be attached to an entity. In our above example that would be the monster's health and its position. Components are attached to their respective entity through the entity's identifier (foreign keys, anyone?). This allows us to attach and detach components to and from entities during runtime. This layout also facilitates accessing only the components we need for certain calculations. For example, in the above code snippet that moves all monsters to the right, we don't need to know the health of any monster. Instead, we are accessing a single component of _all_ monsters, which is commonly the case in calculations related to games. This is called [locality of reference][locality] which is exploited in [column-oriented DBMSs][codbms].

Let's see how our above example could look as a database schema:

```sql
CREATE TABLE entities (
    id SERIAL PRIMARY KEY
);

CREATE TABLE position_components (
    entity_id INT REFERENCES entities(id),
    x INT,
    y INT
);

CREATE TABLE health_components (
    entity_id INT REFERENCES entities(id),
    health INT
);

CREATE TABLE type_components (
    entity_id INT REFERENCES entities(id),
    type TEXT
);

-- create Skeleton
INSERT INTO entities DEFAULT VALUES; -- auto increment ID
INSERT INTO type_components(entity_id, type) VALUES(currval(pg_get_serial_sequence('entities', 'id')), 'Skeleton');
INSERT INTO health_components(entity_id, health) VALUES(currval(pg_get_serial_sequence('entities', 'id')), 10);
INSERT INTO position_components(entity_id, x, y) VALUES(currval(pg_get_serial_sequence('entities', 'id')), 0, 3);

-- create Zombie
INSERT INTO entities DEFAULT VALUES; -- auto increment ID
INSERT INTO type_components(entity_id, type) VALUES(currval(pg_get_serial_sequence('entities', 'id')), 'Zombie');
INSERT INTO health_components(entity_id, health) VALUES(currval(pg_get_serial_sequence('entities', 'id')), 8);
INSERT INTO position_components(entity_id, x, y) VALUES(currval(pg_get_serial_sequence('entities', 'id')), 42, 32);
```

And voilà, we have ourselves an ECS where we can dynamically attach and detach components. Equipping monsters with weapons would look like this:

```sql
CREATE TABLE weapon_components (
    entity_id INT REFERENCES entities(id),
    weapon TEXT
);

INSERT INTO weapon_components(entity_id, weapon) VALUES(1, 'Axe'); -- in this case this is the Skeleton's ID, which would be determined dynamically in a real-life scenario
```

And shifting all monsters a bit to the right is as easy as:

```sql
UPDATE position_components SET x = x + 1  -- no health of any monster loaded into memory at all
```

A full view of the entities with all of their components can be displayed using:

```sql
SELECT 
    e.id,
    tc.type,
    hc.health,
    pc.x,
    pc.y,
    wc.weapon
FROM
    entities AS e
    LEFT JOIN position_components AS pc 
      ON e.id = pc.entity_id
    LEFT JOIN health_components AS hc
      ON e.id = hc.entity_id
    LEFT JOIN type_components AS tc
      ON e.id = tc.entity_id
    LEFT JOIN weapon_components AS wc
      ON e.id = wc.entity_id
```

which results in:

<pre>
id |   type   |  health |  x  |  y  | weapon
---+----------+---------+-----+-----+--------
 1 | Skeleton |      10 |   1 |   3 | Axe
 2 | Zombie   |       8 |  43 |  32 |  
</pre>


Note how we use `LEFT JOIN`s in this _full_ view to make sure we include entities for which we don't have an entry for any given component, as is the case for our `Zombie` regarding `weapon_components`.

# Moar ECS
In summary: a DBMS is a great storage for video game entities when you apply a modern pattern like the entity component system. You can find more elaborate examples of using an ECS in SQL in my [PacmanSQL][pacmansql]-project, for example in the [environmental calculations][environment-sql].

<hr>

[jmonkey]: https://jmonkeyengine.org/
[decorator]: https://archive.org/details/designpatternsel00gamm/page/174/mode/2up
[lor]: https://archive.org/details/designpatternsel00gamm/page/174/mode/2up
[codbms]: https://en.wikipedia.org/wiki/Column-oriented_DBMS
[impedance]: https://en.wikipedia.org/wiki/Object%E2%80%93relational_impedance_mismatch
[pacmansql]: https://github.com/ogrady/PacmanSQL/
[environment-sql]: https://github.com/ogrady/PacmanSQL/blob/master/backend/src/db/sql/environment.sql
[locality]: https://en.wikipedia.org/wiki/Locality_of_reference