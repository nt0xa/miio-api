# miio-api

[![](https://img.shields.io/npm/v/miio-api)](https://www.npmjs.com/package/miio-api)

 The main goal of the project is to implement basic protocol functions without any assumptions
 about specific device, because there are dozens of Xiaomi devices and support them all is very hard task.

## Install

```sh
npm install miio-api
```

## Usage

### typescript

```typescript
import * as miio from "miio-api";

type Power = "on" | "off";
type Props = "power" | "humidity";

(async (): Promise<void> => {
  let device;

  try {
    device = await miio.device({
      address: "192.168.1.31",
      token: "93db466137accd4c9c6204315c542f9c",
    });

    const info = await device.call<Props[], [Power, number]>("get_prop", [
      "power",
      "humidity",
    ]);
    console.log(info);
  } catch (err) {
    console.error("ERROR: " + err);
  } finally {
    await device?.destroy();
  }
})();

```

### javascript

```js
const miio = require("miio-api");

(async () => {
  let device;

  try {
    device = await miio.device({
      address: "192.168.86.31",
      token: "93db466137accd4c9c6204315c542f9c",
    });

    const info = await device.call("get_prop", ["power"]);
    console.log(info);
  } catch (err) {
    console.error("ERROR: " + err);
  } finally {
    if (device) {
      device.destroy();
    }
  }
})();
```

## Debug

```sh
$ DEBUG=miio-api node get-power.js

  miio-api:device:p96skmm1 -> { id: 3779375844, method: 'get_prop', params: [ 'power' ] } +0ms
  miio-api:device:p96skmm1 ->
  miio-api:device:p96skmm1 0000    21 31 00 60 00 00 00 00 04 7d 43 e4 00 68 42 7b
  miio-api:device:p96skmm1 0010    30 66 14 1d dc bf d0 30 7d 7e cc 4b 3a f6 15 0c
  miio-api:device:p96skmm1 0020    7a 0c 82 eb c8 be 3a 35 6b 88 ac cc af fa 03 13
  miio-api:device:p96skmm1 0030    41 60 eb 1e 86 a9 84 1e a9 af c9 7e 89 9d 52 1e
  miio-api:device:p96skmm1 0040    fd 91 18 4a 7c 34 fc 0f 82 07 0d 56 d4 94 ff 48
  miio-api:device:p96skmm1 0050    e4 28 55 0e b4 fd 72 5e d8 c1 29 0c 73 2f 60 44  +5ms
  miio-api:device:p96skmm1 <-
  miio-api:device:p96skmm1 0000    21 31 00 50 00 00 00 00 04 7d 43 e4 00 68 42 7b
  miio-api:device:p96skmm1 0010    13 24 2f c8 34 e1 9d 71 0e b1 b4 d5 06 40 3a 95
  miio-api:device:p96skmm1 0020    b5 9b 12 90 fd 6a e0 41 6b aa b7 e4 7a c8 0a 23
  miio-api:device:p96skmm1 0030    99 71 af 10 2c 9e 1d 63 ef 42 37 c5 e7 36 6b b6
  miio-api:device:p96skmm1 0040    d1 e1 13 10 19 ec 1f 29 9c 2d d6 a7 64 2d 8a 4b  +6ms
  miio-api:device:p96skmm1 <- { result: [ 'off' ], id: 3779375844 } +0ms

```
