---
layout: post
title:  "Running Video Games on the DBMS"
date:   2021-04-16 14:18:00 +0200
categories: jekyll update
---

I am a huge video game fan. Starting with my trusty ol' Game Boy in 1994, I was hooked on pushing pixels around on displays. Finding the map editor in Age of Empires II made me want to become a game designer and I spent hours placing trees, coast lines, and spawn points for units to build appealing maps to play. My love for video games probably had an effect on my choice of studying Computer Science later in my life.

In 2016 I started working as a research assistant at [the chair for Database Management Systems at the University of Tübingen][utuedbms], lead by Torsten Grust. One day, he mentioned a line of work conducted by Johannes Gehrke et al. on the marriage of video games and DBMSs in the 2010s [[1]](https://www.cs.cornell.edu/~wmwhite/papers/2007-SIGMOD-Games.pdf)[[2]](https://www.researchgate.net/publication/221215042_Database_research_in_computer_games)[[3]](https://dl.acm.org/doi/10.1145/1324185.1324186)[[4]](https://dl.acm.org/doi/pdf/10.1145/1376616.1376739)[[5]](https://dl.acm.org/doi/10.1145/2038916.2038936). Obviously, this sparked my interest and I delved into the subject and did a bit of research on my own.
While Gehrke's line of work strove to build a complete engine with an own scripting language that runs on the DBMS, I took a smaller bite and tried to replace specific parts of an already existing engine with SQL-based solutions, such as path finding, map generation, and NPC behaviour.

At the research chair, we had irregular game nights, where we would play video games on a projector in the off-hours. When we discovered [PAC-MAN 256][pacman256], Torsten suggested to recreate it in the browser using a DBMS. Although meant as a joke, I found the idea quite intriguing, as databases can indeed be used from within modern browsers using WebAssembly and [suitable JavaScript libraries](https://github.com/sql-js/sql.js/)! Pac-Man would be a great test bed for my endeavours, as it is a very simple, time-tested game that still contains enough features to make it interesting.

![SQLite Pac-Man Screenshot](/assets/images/screenshot_pacman_sqlite.png){: .center-image }

Screenshot of Pac-Man running purely in the browser using the SQLite WebAsm.
{: .caption }

I started using the aforementioned library and created a very simple version of Pac-Man, in which you could navigate around the map and eat pellets. But I [soon got frustrated][sqlitelastcommit] with some limitations of SQLite and switched to a Postgresql backend. This of course defeats the initial idea of going full browser without a server, but on the other hand it enables multiplayer support. So it's a compromise I am willing to make.
While implementing components of the game, I will accompany my progress with a series of blog posts and explain how the components are done in SQL. The source code will be available in a [GitHub repository][pacmansql].






[utuedbms]: https://db.inf.uni-tuebingen.de/
[pacman256]: https://store.steampowered.com/app/455400/PACMAN_256/
[pacmansql]: https://github.com/ogrady/PacmanSQL
[sqlitelastcommit]: https://github.com/ogrady/PacmanSQL/commit/f76b1df2345caf32c40f4be24235e2dd4beb73ec