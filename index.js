
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

let parentFiber = null;
let currentFiber = null;
let globalId = 0;
let isBatchUpdating = false
const stateList = []
const destroyList = []
const effectList = []
const renderList = []

function asyncRun(fn, { list, fiber, type }) { // type 暂时没什么用，用来debug
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
    const index = fiber.hookIndex++
    if (!fiber.mounted) {
        const state = typeof x === 'function' ? x() : x;
        fiber.hooksList.push({
            index,
            state,
        })
    }
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
                fiber.reset()
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
    const index = fiber.hookIndex++
    if (!fiber.mounted) {
        fiber.hooksList.push({
            index,
            ref: { current: value },
        })
    }
    const currentHook = fiber.hooksList[index];
    return currentHook.ref
}


export function useEffect(create, devs) {
    const fiber = currentFiber;
    const index = fiber.hookIndex++;
    if (!fiber.mounted) {
        const destroy = {}
        setTimeout(() => {
            destroy.fn = create()
        })
        fiber.hooksList.push({
            index,
            devs,
            destroy
        })
    }
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

export function useCallback(create, devs) {
    const callbackRef = useRef(create)
    useEffect(() => {
        callbackRef.current = create
    }, devs)
    return callbackRef.current
}

class Fiber {
    constructor(comp, props){
        this.comp = comp
        this.props = props
        this.id = globalId++
        this.mounted = false 
        this.children = []
        this.childIndex = 0
        this.hooksList = []
        this.hookIndex = 0
    }
    render(){
        this.comp(this.props)
    }
    reset(){
        this.hookIndex = 0
        this.childIndex = 0
        this.render()
    }
   
}

export function wrap(comp, props) {
    parentFiber = currentFiber
    if (!currentFiber || !currentFiber.mounted) {
         const fiber = new Fiber(comp, props)
        if (currentFiber) {
            currentFiber.children.push(fiber)
            fiber.parent = currentFiber;
        }
        currentFiber = fiber;
        fiber.reset()
        fiber.mounted = true;
    } else if (currentFiber.mounted) {
        const fiber = currentFiber.children[currentFiber.childIndex++]
        if (fiber.comp !== comp) {
            throw new Error('组件顺序变更') // 精力有限，先写个组件顺序固定的
        }
        fiber.props = props
        currentFiber = fiber;
        fiber.reset()
    }

    currentFiber = parentFiber;
}
