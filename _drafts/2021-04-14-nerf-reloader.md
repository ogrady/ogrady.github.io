---
layout: post
title:  "NERF Reloader"
date:   2021-04-14 21:29:00 +0200
categories: jekyll update
---

## To Conjure a Problem
Since COVID has left us all with a bit more time on our hands than we are used to, I have taken up [NERF][nerf] as a new temporary hobby. Perfect for social events where you absolutely want to keep your distance!
For the uninitiated: NERF is a series of toys that mainly consists of dart blasters. Read: plastic toys that look a bit like guns, but only fire soft foam darts. A considerable amount of time when playing with NERF is spent picking your darts up from the ground and pushing them back into the magazine.

![NERF Recon MK II](/assets/images/recon_mkii.jpg){: .center-image }
NERF Recon MK II with a [3D printed sight](https://www.thingiverse.com/thing:3332524).
{: .caption }

Although I have already sunk a considerable amount of time and money into this new obsession, I have not played a single round of [NERF war][nerfwar], nor am I sure I ever will. Just modifying blasters is way too much fun in itself! But one thing that already vexes me is the need to constantly refill the darts. I have ordered additional, larger magazines (18 darts each, whooop!), but obviously, that's only a temporary solution for a very serious permanent problem!

Since I am doing a lot of home automation lately, I immediately wondered if this tedious task couldn't be outsourced to a machine or device. All you'd have to do is throw the darts into some sort of hopper, funnel them through a pipe of appropriate diameter, and then push them into the magazine. Maybe you would need to shake the hopper a bit to get them to fall through, but that should be it. Right? Wrong. NERF darts are right cylinders of roughly 1cm × 8cm and have an _orange rubber tip which needs to face front_. So even if you managed to funnel them in line, some darts would be backwards.

![NERF Darts Magazine](/assets/images/nerf_darts.jpg){: .center-image }
Transparent NERF magazine which holds up to twelve darts with one unloaded dart next to it.
{: .caption }

Luckily, I am blessed with an august clique from my school years. So I asked them and one of them -- a machine engineer -- suggested training a monkey to retrieve the darts and put them back into the magazine. Shoutout to that clique and thanks for this and several more amazing proposals! Since our landlord would probably have vetoed the monkey, I had to fall back to the next best suggestion: installing an optical sensor somewhere in the pipe to detect if the end piece of the dart is orange. If not, that dart is backwards and should be ejected.
Initially, I wanted to go for a purely mechanical solution. But I also kind of have a Master's in Computer Science, so I don't really have an excuse to not involve some fancy-schmancy electronics. Join me on my journey to solve a problem that I would probably never had if I didn't look to solve it!


## Hocus Pocus

### Housing
For my 31st birthday, my wonderful girlfriend surprised me with a 3D printer (Creality Ender 3). So I only briefly considered doing some woodwork or putting together PVC pipes from the hardward store for the housing before I settled on 3D printing the whole thing. Full disclosure: I have no idea how to do CAD. But I am doing it anway using [FreeCAD][freecad]. I am no technical engineer either, so I am probably lacking a lot of vocabulary that would be correct here. So if you are an engineer or CAD artist, you might want to sit down for this one.

> Aerodynamically, the bumblee bee shouldn't be able to fly, but the bumble bee doesn't know it so it goes on flying anyway

– attributed to André Sainte-Laguë

As explained above, we need a pipe structure where the darts would be shaken into. I decided the diameter should be 1.5 × the diameter of a dart. That way they are less likely to get stuck when they are slightly deformed (which can happen), but not too wide for them to wedge into place or have the next dart get squeezed into the extra space. They would then fall into a piece of pipe that is just slightly longer than a single dart that is encased in a drum. This allows that piece of pipe to rotate 180° without the dart falling out.

We need at least two motors of sorts. One to do the turning of falsely oriented darts, and one to push darts into the magazine. 

To push in the darts, I considered a solenoid 

![First Design](/assets/images/refiller_sketch.jpeg){: .center-image }

First design for the refiller I presented my friends with.
{: .caption }





[nerf]: https://nerf.hasbro.com/
[nerfwar]: https://en.wikipedia.org/wiki/Nerf_war
[freecad]: https://www.freecadweb.org/