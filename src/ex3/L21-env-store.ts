import { add, map, zipWith } from "ramda";
import { Value } from './L21-value-store';
import { Result, makeFailure, makeOk, bind, either } from "../shared/result";

// ========================================================
// Box datatype
// Encapsulate mutation in a single type.
type Box<T> = T[];
const makeBox = <T>(x: T): Box<T> => ([x]);
const unbox = <T>(b: Box<T>): T => b[0];
const setBox = <T>(b: Box<T>, v: T): void => { b[0] = v; return; }

// ========================================================
// Store datatype
export interface Store {
    tag: "Store";
    vals: Box<Value>[];
}
// const INIT_SIZE = 10


export const isStore = (x: any) : x is Store =>
    x.tag==="Store"

export const makeEmptyStore = (): Store => {
    const memory: Box<Value>[] = []
    return ({tag: "Store", vals: memory})
}

export const theStore: Store = makeEmptyStore()

export const extendStore = (s: Store, val: Value): Store => {
    s.vals = s.vals.concat(makeBox(val))
    return s
}

export const applyStore = (store: Store, address: number): Result<Value> =>
    (store.vals.length > address && address >= 0) ? makeOk(unbox(store.vals[address])) :
        makeFailure("NoSuchElement error. Address is not valid.")

    
export const setStore = (store: Store, address: number, val: Value): void => {
    if (store.vals.length > address && address >= 0)
        store.vals[address] = makeBox(val)
}

// ========================================================
// Environment data type
// export type Env = EmptyEnv | ExtEnv;
export type Env = GlobalEnv | ExtEnv;

interface GlobalEnv {
    tag: "GlobalEnv";
    vars: Box<string[]>;
    addresses: Box<number[]>
}

export interface ExtEnv {
    tag: "ExtEnv";
    vars: string[];
    addresses: number[];
    nextEnv: Env;
}

const makeGlobalEnv = (): GlobalEnv =>
    ({tag: "GlobalEnv", vars: makeBox([]), addresses:makeBox([])});

export const isGlobalEnv = (x: any): x is GlobalEnv => x.tag === "GlobalEnv";

// There is a single mutable value in the type Global-env
export const theGlobalEnv = makeGlobalEnv();

export const makeExtEnv = (vs: string[], addresses: number[], env: Env): ExtEnv =>
    ({tag: "ExtEnv", vars: vs, addresses: addresses, nextEnv: env});

const isExtEnv = (x: any): x is ExtEnv => x.tag === "ExtEnv";

export const isEnv = (x: any): x is Env => isGlobalEnv(x) || isExtEnv(x);

// Apply-env
export const applyEnv = (env: Env, v: string): Result<number> =>
    isGlobalEnv(env) ? applyGlobalEnv(env, v) :
    applyExtEnv(env, v);

const applyGlobalEnv = (env: GlobalEnv, v: string): Result<number> => {
    const ind = unbox(env.vars).indexOf(v);
    if(ind != -1)
        return makeOk(unbox(env.addresses)[ind])
    else
        return makeFailure("NoSuchElement error. Invalid VarName.")
}

export const globalEnvAddBinding = (v: string, addr: number): void => {
    theGlobalEnv.vars = makeBox(unbox(theGlobalEnv.vars).concat([v]));
    theGlobalEnv.addresses = makeBox(unbox(theGlobalEnv.addresses).concat([addr]));
}

const applyExtEnv = (env: ExtEnv, v: string): Result<number> =>
    env.vars.includes(v) ? makeOk(env.addresses[env.vars.indexOf(v)]) :
    applyEnv(env.nextEnv, v)
