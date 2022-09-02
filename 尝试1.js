
Object.defineProperty(Object, 'is', {
    value: function (x, y) {
        if (x === y) {
            return x !== 0 || 1 / x === 1 / y;
        }
        return x !== x && y !== y;
    },
    configurable: true,
    enumerable: false,
    writable: true
})

export function equal(arr1, arr2) {
    if (!arr2) {
        return false
    }
    const len = arr1.length;
    for (let i = 0; i < len; i++) {
        if (!Object.is(arr1[i], arr2[i])) {
            return false;
        }
    }
    return true
}

let currentFiber = null;

let isBatchUpdating = false
const stateList = []
const destroyList = []
const effectList = []
const renderList = []

function asyncRun(fn, { list, fiber, type }) {
    if (![renderList].includes(list) || list.findIndex(v => v.fiber === fiber) === -1) {
        list.push({
            fn,
            fiber,
        })
    }

    if (!isBatchUpdating) {
        isBatchUpdating = true
        setTimeout(() => {
            for (const list of [stateList, renderList, destroyList, effectList]) {
                list.forEach(({ fn }) => fn())
                list.splice(0, list.length)
            }
            isBatchUpdating = false

        })
    }
}



export function useState(x) {
    const fiber = currentFiber;
    if (!fiber.mounted) {
        const state = typeof x === 'function' ? x() : x;
        fiber.hooksList.push({
            index: fiber.hookIndex,
            state,
        })
    }
    const index = fiber.hookIndex++
    const currentHook = fiber.hooksList[index];
    const dispatch = (payload) => {

        let lastState
        let newState
        asyncRun(() => {
            lastState = currentHook.state
            newState = typeof payload === 'function' ? payload(lastState) : payload;
            currentHook.state = newState;
        }, {
            list: stateList,
            fiber,
            type: 'state'
        })

        asyncRun(() => {
            if (lastState !== newState) {
                currentFiber = fiber;
                fiber.hookIndex = 0
                fiber.render()
            }
        }, {
            list: renderList,
            fiber,
            type: 'render'
        })

    }

    return [currentHook.state, dispatch];
}

export function useRef(value) {
    const fiber = currentFiber;
    if (!fiber.mounted) {
        fiber.hooksList.push({
            index: fiber.hookIndex,
            ref: { current: value },
        })
    }
    const index = fiber.hookIndex++
    const currentHook = fiber.hooksList[index];
    return currentHook.ref
}

export function useEffect(create, devs) {
    const fiber = currentFiber;
    if (!fiber.mounted) {
        const destroy = {}
        setTimeout(() => {
            destroy.fn = create()
        })
        fiber.hooksList.push({
            index: fiber.hookIndex,
            devs,
            destroy
        })
    }
    const index = fiber.hookIndex++;
    const lastDevs = fiber.hooksList[index].devs;
    const currentHook = fiber.hooksList[index];
    if (!equal(lastDevs, devs)) {

        asyncRun(() => {
            setTimeout(() => {
                currentHook.destroy.fn?.()
            })
        }, {
            list: destroyList,
            fiber,
            type: 'destroy'
        })

        asyncRun(() => {
            setTimeout(() => {
                currentHook.devs = devs;
                currentHook.destroy.fn = create();
            })
                
        }, {
            list: effectList,
            fiber,
            type: 'effect'
        })

    }

}

export function wrap(comp) {

    const fiber = {
        mounted: false,
        hookIndex: 0,
        child: null,
        hooksList: [],
        render: () => {
            comp()
        },
    }

    if (currentFiber && !currentFiber.child) {
        currentFiber.child = fiber
        fiber.parent = currentFiber;
    }

    currentFiber =fiber;
    comp()
    fiber.mounted = true;
    currentFiber = fiber;
}

export function getFiber() {
    return currentFiber
}

export function render(fn) {
    fn()
}