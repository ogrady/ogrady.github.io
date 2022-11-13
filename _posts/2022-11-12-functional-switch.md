---
layout: post
title:  "A switch Expression in JavaScript"
date:   2022-11-12 21:29:00 +0200
categories: jekyll update
---

## JavaScript `switch` Statement

JavaScript, as many other languages, features the `switch` statement. It serves as a convenient way for branching logic that depends on a single value. I.e.:

```js
function magic(n) {
    let result = "unknown"
    switch (n) {
        case 1:
            console.log("you typed one")
            result = "small number"
            break
        case 2:
            console.log("you typed two")
            result = "small number"
            break
        case 1000:
            console.log("you typed one thousand")
            result = "large number"
            break
        case -1:
            console.log("this is the first negative case")
        case -2:
        case -3:
            console.log("you typed something negative")
            result = "negative number"
            break
        default:
            console.log("sorry, I only know very few numbers. :(")
            break
    }
    return result
}

console.log(magic(1))     // "you typed one" "small number"
console.log(magic(-1))    // "this is the first negative case" "you typed something negative" "negative number"
console.log(magic(1000))  // "you typed one thousand" "large number"
console.log(magic(42))    // "sorry, I knoly know very few numbers. :(" "unknown"
```

There are several things you should know about the `switch` statement, which can be observed above:

- Cases work on equality. In the above example, we inspect the value of `n` and enter the first case equal to `n`'s value. You can't specify ranges or other arbitrary conditions, as you would be able to in an `if`.
- Cases should end with a `break`. If you don't add a `break` at the end of your case, it will _fall through_ to the next case, even if that case's condition does not match. You can observe this behaviour at the output of `magic(-1)`, where the runtime enters at `case -1` and falls into `case -2` and `case -3` until it encounters a `break`.
- `switch` statements can have `default` cases. They are entered whenever no other case was entered (and broke out of) up until that point. If you don't specify a `default` case and no other case covers the value you are switching on, nothing (bad) happens.


## Statements and Expressions

As mentioned earlier, `switch` is strictly a statement in JavaScript. That means it is executed and has a side effect. This differs from expressions, which are reduced to a simpler form. Think `41 + 1`, which can be reduced to the constant `42`. There are times when you would like your statements to be expressions. For example if you want to conditionally assign a value to a variable. You can already do this for `if` statements when using the ternary syntax:

```js
function f(x) {
    let y
    if (x >= 0) {
        y = "positive"
    } else {
        y = "negative"
    }
    …
}
```

can be written as:

```js
function f(x) {
    const y = x >= 0 ? "postive" : "negative"
}
```

(which is actually preferable, as you can make `y` a `const`, as you don't have to open a new scope for your branching logic.)

But there is no way to do it with `switch`. Yet, I have witnessed people ask for it several times on StackOverflow and the like. And I have even found myself to need something like it myself. So I present to you a `switch` expression, which will return a result:

```js
function switchxpr(value, cases, defaultCase = () => {}) {
  let result
  let inFallthrough = false
  let entries = Object.entries(cases)
  
  let i = 0
  while (i < entries.length) {
    const [condition, body] = entries[i]
    const [expression, fallthrough] = body
    if (inFallthrough || (value == condition)) {  // keys are always strings! -> ==
        result = expression()
        inFallthrough = fallthrough
        if (!inFallthrough) {
            return result
        }
    }
    i += 1
  }
  
  return result ?? defaultCase()
}
```

which is invoked like this:

```js
function magic2(n) {
    return switchxpr(n, {
        1: 
            [() => { 
                console.log("you typed one"); 
                return "small number" 
            }],
        2: 
            [() => { 
                console.log("you typed two"); 
                return "small number" 
            }],
        1000: 
            [() => { 
                console.log("you typed one thousand"); 
                return "large number" 
            }],
        "-1": 
            [() => { 
                console.log("this is the first negative case"); 
            }, true],
        "-2": 
            [() => {}, true], 
        "-3": 
            [() => {
                console.log("you typed something negative")
                return "negative number" 
            }, true],
    }, () => console.log("sorry, I only know very few numbers. :("))
}
```

Some fair warnings about this construct:

- In the case of fallthroughs, each later case can override the final result that is returned. 
- As the cases are defined as an object (dictionary), all keys are implicitly strings. This is one of the very few times where you'll want to use `==` over `===` – with all of its consequences!
- As `switch` enters the first matching case and then only continues if a fallthrough is specified, the order in which the cases are defined is highly relevant. `Object.entries`, which is used to iterate over the cases, does not guarantee (as of the time of writing) a certain order. When invoked as shown above, the order should always be correct. But keep in mind that there is actually no guarantee for this.
- `undefined` is not considered a proper result. If the last entered branch sets the `result` to `undefined`, the default branch will be invoked to produce the final result.

But most if not all of these points can be overcome or adjusted to your needs. Enjoy your `switch` expression!