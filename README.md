# Rate-limited queue

Queue tasks and throttle their execute them

# Installation

```sh
npm install rate-limited-queue
```

# Usage

```js
const createQueue = require("rate-limited-queue");
const queue = createQueue(
  1000 /* time based sliding window */,
  10 /* max concurrent tasks in the sliding window */,
  15 /* global max concurrent tasks (Optional. Default is Infinity) */);
queue(() => {
  // do something...
});
queue([
  () => { /* do another thing */ },
  () => { /* and another thing */ }
]);
```
