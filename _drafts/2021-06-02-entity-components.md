---
layout: post
title:  "Entity Components"
date:   2021-06-02 21:19:00 +0200
categories: jekyll update
---

## The Yawning Gash
If you have ever dabbled in video game development in the past ten or twenty years, chances are you used an object oriented programming language to do so. Hell, my first attempts at creating a game were done using the [jMonkey engine](jmonkey)[^1]. And one can easily see why OOP is popular for game development: it is very convenient to summarise data into semantic classes

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

they are perfect to group common functionality together in base classes and specialise them in subclasses


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

So the idea of marrying video games and OOP sounds just perfect. You know what does

<hr>

[^1]: Nope, definitely not going to link embarassing old code of mine.


[jmonkey]: https://jmonkeyengine.org/
