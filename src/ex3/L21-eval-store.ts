// L2-eval-box.ts
// L2 with mutation (set!) and env-box model
// Direct evaluation of letrec with mutation, define supports mutual recursion.

import { map, reduce, repeat, zipWith } from "ramda";
import {
    isBoolExp, isCExp, isLitExp, isNumExp, isPrimOp, isStrExp, isVarRef,
    isAppExp, isDefineExp, isIfExp, isLetExp, isProcExp, Binding, VarDecl, CExp, Exp, IfExp, LetExp, ProcExp, Program,
    parseL21Exp, DefineExp, isSetExp, SetExp
} from "./L21-ast";
import {
    applyEnv,
    makeExtEnv,
    Env,
    Store,
    setStore,
    extendStore,
    ExtEnv,
    // applyEnvStore,
    theGlobalEnv,
    globalEnvAddBinding,
    theStore,
    applyStore
} from "./L21-env-store";
import { isClosure, makeClosure, Closure, Value } from "./L21-value-store";
import { applyPrimitive } from "./evalPrimitive-store";
import { first, rest, isEmpty } from "../shared/list";
import {Result, bind, safe2, mapResult, makeFailure, makeOk, isOk} from "../shared/result";
import { parse as p } from "../shared/parser";

// ========================================================
// Eval functions

const applicativeEval = (exp: CExp, env: Env): Result<Value> =>
    isNumExp(exp) ? makeOk(exp.val) :
    isBoolExp(exp) ? makeOk(exp.val) :
    isStrExp(exp) ? makeOk(exp.val) :
    isPrimOp(exp) ? makeOk(exp) :
    isVarRef(exp) ? bind(applyEnv(env, exp.var),address => applyStore(theStore, address)) : // not sur about it//////////////////////////////
    isLitExp(exp) ? makeOk(exp.val as Value) :
    isIfExp(exp) ? evalIf(exp, env) :
    isProcExp(exp) ? evalProc(exp, env) :
    isLetExp(exp) ? evalLet(exp, env) :
    isAppExp(exp) ? safe2((proc: Value, args: Value[]) => applyProcedure(proc, args))
                        (applicativeEval(exp.rator, env), mapResult((rand: CExp) => applicativeEval(rand, env), exp.rands)) :
    isSetExp(exp) ? evalSet(exp, env) :
    exp;

export const isTrueValue = (x: Value): boolean =>
    ! (x === false);

const evalIf = (exp: IfExp, env: Env): Result<Value> =>
    bind(applicativeEval(exp.test, env),
         (test: Value) => isTrueValue(test) ? applicativeEval(exp.then, env) : applicativeEval(exp.alt, env));

const evalProc = (exp: ProcExp, env: Env): Result<Closure> =>
    makeOk(makeClosure(exp.args, exp.body, env));

// KEY: This procedure does NOT have an env parameter.
//      Instead we use the env of the closure.
const applyProcedure = (proc: Value, args: Value[]): Result<Value> =>
    isPrimOp(proc) ? applyPrimitive(proc, args) :
    isClosure(proc) ? applyClosure(proc, args) :
    makeFailure(`Bad procedure ${JSON.stringify(proc)}`);

const applyClosure = (proc: Closure, args: Value[]): Result<Value> => {
    const vars = map((v: VarDecl) => v.var, proc.params);
    const addresses: number[] = map(arg => extendStore(theStore, arg).vals.length-1, args)      //same shit about the addresses
    const newEnv: ExtEnv = makeExtEnv(vars, addresses, proc.env)
    return evalSequence(proc.body, newEnv);
}

// Evaluate a sequence of expressions (in a program)
export const evalSequence = (seq: Exp[], env: Env): Result<Value> =>
    isEmpty(seq) ? makeFailure("Empty program") :
    evalCExps(first(seq), rest(seq), env);
    
const evalCExps = (first: Exp, rest: Exp[], env: Env): Result<Value> =>
    isDefineExp(first) ? evalDefineExps(first, rest) :
    isCExp(first) && isEmpty(rest) ? applicativeEval(first, env) :
    isCExp(first) ? bind(applicativeEval(first, env), _ => evalSequence(rest, env)) :
    first;

const evalDefineExps = (def: DefineExp, exps: Exp[]): Result<Value> => {
    //deal with define
    const store : Result<Store> =
        bind(applicativeEval(def.val, theGlobalEnv), value => makeOk(extendStore(theStore, value)))
    const address : number = (isOk(store)) ? store.value.vals.length-1 : -1
    globalEnvAddBinding(def.var.var, address)
    //return value of define - send the rest to be dealt with
    return evalCExps(first(exps), rest(exps), theGlobalEnv) //not sure if this it the function need to be called
}

// Main program
// L2-BOX @@ Use GE instead of empty-env
export const evalProgram = (program: Program): Result<Value> =>
    evalSequence(program.exps, theGlobalEnv);

export const evalParse = (s: string): Result<Value> =>
    bind(bind(p(s), parseL21Exp), (exp: Exp) => evalSequence([exp], theGlobalEnv));

// LET: Direct evaluation rule without syntax expansion
// compute the values, extend the env, eval the body.
const evalLet = (exp: LetExp, env: Env): Result<Value> => {
    const vals = mapResult((v: CExp) => applicativeEval(v, env), map((b: Binding) => b.val, exp.bindings));
    const vars = map((b: Binding) => b.var.var, exp.bindings);

    return bind(vals, (vals: Value[]) => {
        const addresses = map(val => extendStore(theStore, val).vals.length-1, vals) // not sure if this is the relevant address
        const newEnv = makeExtEnv(vars, addresses, env)
        return evalSequence(exp.body, newEnv);
    })
}

const evalSet = (exp: SetExp , env: Env): Result<Value> => {
    const address = applyEnv(env, exp.var.var)
    const val = applicativeEval(exp.val, env)
    return safe2( (address: number, val: Value) => makeOk(setStore(theStore, address, val)))
        (address, val)
}
