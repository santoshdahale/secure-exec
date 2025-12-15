## lightweight sandboxes

- uses wasix for linux vm
    - gives you the real coreutils, not the fake js implementations
    - gives support for python, etc
- uses isolated-vm for the js isolation
    - high perf is needed for native js (eg nextjs)
    - lower memory overhead when using isolates

## webcontainers

- emulates linux vm/posix in javascript vs we use wasix so you have the real tool and not some knock off with the wrong impl
- uses serviceworkers for isolation

## openwebcontainers

- emulates linux vm/poxis in js
- uses quickjs for isolation

## other options not considered

- compile js runtime to wasm
    - quickjs (without wasm) is 45x (https://zoo.js.org/?arch=amd64) faster than quickjs even when compiled to js
    - spidermonkey might be faster
    - both are too slow
- use deno
    - too many runtime edge cases
    - not sandboxed well enough
    - don't want to bundle a 1 gb rust binary
    - might still be a good backup plan
- use deno as a library & impl custom permissions
    - this is the only want to improve permissions for deno
    - would provide lighter weight runtime
    - again, too expensive

