/**
 * @freequantumstore/sdk — Quantum Circuit Simulator
 *
 * Statevector simulation of quantum circuits up to ~20 qubits.
 * Implements standard single-, two-, and three-qubit gates with
 * correct unitary matrices, Born-rule measurement with collapse,
 * multi-shot sampling, and code generation for Qiskit / Cirq.
 *
 * @example
 * ```ts
 * import { QuantumCircuit } from '@freequantumstore/sdk/circuit';
 *
 * const bell = new QuantumCircuit(2).h(0).cx(0, 1);
 * console.log(bell.sample(1000)); // { "00": ~500, "11": ~500 }
 * ```
 */

/** A complex number represented as [real, imaginary]. */
export type Complex = [number, number];

/** One row of the state-vector table returned by {@link QuantumCircuit.getState}. */
export interface StateEntry {
  /** Computational-basis label, e.g. `"010"`. */
  basis: string;
  /** Complex amplitude as [real, imag]. */
  amplitude: Complex;
  /** Born-rule probability (|amplitude|^2). */
  probability: number;
}

/** An entry in the gate log used for code generation. */
interface GateRecord {
  name: string;
  qubits: number[];
  params: number[];
}

// ── helpers ────────────────────────────────────────────────────────

/** Multiply-and-add two complex products: a*x + b*y. */
function cmulAdd(a: Complex, x: Complex, b: Complex, y: Complex): Complex {
  return [
    a[0] * x[0] - a[1] * x[1] + b[0] * y[0] - b[1] * y[1],
    a[0] * x[1] + a[1] * x[0] + b[0] * y[1] + b[1] * y[0],
  ];
}

/** 2x2 unitary matrix stored as [[a,b],[c,d]] of Complex values. */
type Mat2 = [[Complex, Complex], [Complex, Complex]];

const S2 = 1 / Math.sqrt(2);

/** Standard single-qubit gate matrices. */
const GATE_MATRICES: Record<string, Mat2> = {
  H: [[[S2, 0], [S2, 0]], [[S2, 0], [-S2, 0]]],
  X: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]],
  Y: [[[0, 0], [0, -1]], [[0, 1], [0, 0]]],
  Z: [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]],
  S: [[[1, 0], [0, 0]], [[0, 0], [0, 1]]],
  T: [[[1, 0], [0, 0]], [[0, 0], [Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)]]],
};

/** Build an Rx(theta) matrix. */
function rxMatrix(theta: number): Mat2 {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [[[c, 0], [0, -s]], [[0, -s], [c, 0]]];
}

/** Build an Ry(theta) matrix. */
function ryMatrix(theta: number): Mat2 {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [[[c, 0], [-s, 0]], [[s, 0], [c, 0]]];
}

/** Build an Rz(theta) matrix. */
function rzMatrix(theta: number): Mat2 {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [[[c, -s], [0, 0]], [[0, 0], [c, s]]];
}

// ── main class ─────────────────────────────────────────────────────

export class QuantumCircuit {
  private _nQubits: number;
  private _dim: number;
  private _state: Complex[];
  private _log: GateRecord[] = [];

  /** Create a circuit with `nQubits` qubits, initialised to |0...0>. */
  constructor(nQubits: number) {
    if (nQubits < 1 || nQubits > 24) {
      throw new RangeError('nQubits must be between 1 and 24');
    }
    this._nQubits = nQubits;
    this._dim = 1 << nQubits;
    this._state = new Array<Complex>(this._dim);
    this._resetState();
  }

  /** Number of qubits in the circuit. */
  get numQubits(): number {
    return this._nQubits;
  }

  // ── single-qubit gates ──────────────────────────────────────────

  /** Hadamard gate. */
  h(qubit: number): this {
    this._applySingle('H', qubit);
    this._log.push({ name: 'h', qubits: [qubit], params: [] });
    return this;
  }

  /** Pauli-X (NOT) gate. */
  x(qubit: number): this {
    this._applySingle('X', qubit);
    this._log.push({ name: 'x', qubits: [qubit], params: [] });
    return this;
  }

  /** Pauli-Y gate. */
  y(qubit: number): this {
    this._applySingle('Y', qubit);
    this._log.push({ name: 'y', qubits: [qubit], params: [] });
    return this;
  }

  /** Pauli-Z gate. */
  z(qubit: number): this {
    this._applySingle('Z', qubit);
    this._log.push({ name: 'z', qubits: [qubit], params: [] });
    return this;
  }

  /** S gate (sqrt-Z, pi/2 phase). */
  s(qubit: number): this {
    this._applySingle('S', qubit);
    this._log.push({ name: 's', qubits: [qubit], params: [] });
    return this;
  }

  /** T gate (pi/4 phase). */
  t(qubit: number): this {
    this._applySingle('T', qubit);
    this._log.push({ name: 't', qubits: [qubit], params: [] });
    return this;
  }

  /** Rx rotation by angle `theta` (radians). */
  rx(qubit: number, theta: number): this {
    this._applyMatrix(rxMatrix(theta), qubit);
    this._log.push({ name: 'rx', qubits: [qubit], params: [theta] });
    return this;
  }

  /** Ry rotation by angle `theta` (radians). */
  ry(qubit: number, theta: number): this {
    this._applyMatrix(ryMatrix(theta), qubit);
    this._log.push({ name: 'ry', qubits: [qubit], params: [theta] });
    return this;
  }

  /** Rz rotation by angle `theta` (radians). */
  rz(qubit: number, theta: number): this {
    this._applyMatrix(rzMatrix(theta), qubit);
    this._log.push({ name: 'rz', qubits: [qubit], params: [theta] });
    return this;
  }

  // ── two-qubit gates ─────────────────────────────────────────────

  /** Controlled-X (CNOT) gate. */
  cx(control: number, target: number): this {
    this._assertQubit(control);
    this._assertQubit(target);
    const cmask = 1 << (this._nQubits - 1 - control);
    const tmask = 1 << (this._nQubits - 1 - target);
    for (let i = 0; i < this._dim; i++) {
      if (!(i & cmask)) continue; // control must be |1>
      if (i & tmask) continue;    // process each pair once
      const j = i | tmask;
      const tmp = this._state[i];
      this._state[i] = this._state[j];
      this._state[j] = tmp;
    }
    this._log.push({ name: 'cx', qubits: [control, target], params: [] });
    return this;
  }

  /** Controlled-Z gate. */
  cz(control: number, target: number): this {
    this._assertQubit(control);
    this._assertQubit(target);
    const cmask = 1 << (this._nQubits - 1 - control);
    const tmask = 1 << (this._nQubits - 1 - target);
    for (let i = 0; i < this._dim; i++) {
      if ((i & cmask) && (i & tmask)) {
        this._state[i] = [-this._state[i][0], -this._state[i][1]];
      }
    }
    this._log.push({ name: 'cz', qubits: [control, target], params: [] });
    return this;
  }

  /** SWAP gate — exchanges the states of two qubits. */
  swap(q1: number, q2: number): this {
    // SWAP = three CNOTs
    this.cx(q1, q2);
    this.cx(q2, q1);
    this.cx(q1, q2);
    // Replace the three cx log entries with one swap
    this._log.splice(-3, 3, { name: 'swap', qubits: [q1, q2], params: [] });
    return this;
  }

  // ── three-qubit gates ───────────────────────────────────────────

  /** Toffoli (CCX) gate — flips target when both controls are |1>. */
  ccx(c1: number, c2: number, target: number): this {
    this._assertQubit(c1);
    this._assertQubit(c2);
    this._assertQubit(target);
    const m1 = 1 << (this._nQubits - 1 - c1);
    const m2 = 1 << (this._nQubits - 1 - c2);
    const mt = 1 << (this._nQubits - 1 - target);
    for (let i = 0; i < this._dim; i++) {
      if (!(i & m1) || !(i & m2)) continue;
      if (i & mt) continue;
      const j = i | mt;
      const tmp = this._state[i];
      this._state[i] = this._state[j];
      this._state[j] = tmp;
    }
    this._log.push({ name: 'ccx', qubits: [c1, c2, target], params: [] });
    return this;
  }

  // ── measurement ─────────────────────────────────────────────────

  /**
   * Measure a single qubit. Collapses the state and returns 0 or 1
   * according to the Born rule.
   */
  measure(qubit: number): 0 | 1 {
    this._assertQubit(qubit);
    const mask = 1 << (this._nQubits - 1 - qubit);
    let p0 = 0;
    let p1 = 0;
    for (let i = 0; i < this._dim; i++) {
      const p = this._state[i][0] ** 2 + this._state[i][1] ** 2;
      if (i & mask) p1 += p;
      else p0 += p;
    }
    const result: 0 | 1 = Math.random() < p0 ? 0 : 1;
    const norm = Math.sqrt(result === 0 ? p0 : p1);
    for (let i = 0; i < this._dim; i++) {
      const bit = (i & mask) ? 1 : 0;
      if (bit !== result) {
        this._state[i] = [0, 0];
      } else {
        this._state[i] = [this._state[i][0] / norm, this._state[i][1] / norm];
      }
    }
    this._log.push({ name: 'measure', qubits: [qubit], params: [] });
    return result;
  }

  /**
   * Measure all qubits at once. Returns the measured integer value
   * (e.g. 5 for |101>). Collapses the state to the measured basis.
   */
  measureAll(): number {
    const r = Math.random();
    let cum = 0;
    let outcome = this._dim - 1;
    for (let i = 0; i < this._dim; i++) {
      cum += this._state[i][0] ** 2 + this._state[i][1] ** 2;
      if (r <= cum) { outcome = i; break; }
    }
    // Collapse to |outcome>
    for (let i = 0; i < this._dim; i++) {
      this._state[i] = i === outcome ? [1, 0] : [0, 0];
    }
    return outcome;
  }

  /**
   * Sample the output distribution `shots` times **without**
   * collapsing the state. Returns a map from bitstring to count.
   *
   * @example
   * ```ts
   * const counts = qc.sample(1024);
   * // { "00": 512, "11": 508, "01": 2, "10": 2 }
   * ```
   */
  sample(shots: number): Record<string, number> {
    const probs = this.getProbabilities();
    const counts: Record<string, number> = {};
    for (let s = 0; s < shots; s++) {
      let r = Math.random();
      let cum = 0;
      let outcome = this._dim - 1;
      for (let i = 0; i < this._dim; i++) {
        cum += probs[i];
        if (r <= cum) { outcome = i; break; }
      }
      const key = outcome.toString(2).padStart(this._nQubits, '0');
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  // ── state access ────────────────────────────────────────────────

  /**
   * Returns the full state vector as an array of {@link StateEntry}
   * objects, filtering out near-zero amplitudes.
   */
  getState(): StateEntry[] {
    const result: StateEntry[] = [];
    for (let i = 0; i < this._dim; i++) {
      const [re, im] = this._state[i];
      const prob = re * re + im * im;
      if (prob < 1e-14) continue;
      result.push({
        basis: i.toString(2).padStart(this._nQubits, '0'),
        amplitude: [re, im],
        probability: prob,
      });
    }
    return result;
  }

  /** Returns an array of Born-rule probabilities for each basis state. */
  getProbabilities(): number[] {
    return this._state.map(([re, im]) => re * re + im * im);
  }

  /** Returns a copy of the raw state vector as [real, imag] pairs. */
  getStatevector(): Complex[] {
    return this._state.map(([re, im]) => [re, im]);
  }

  // ── reset / clone ───────────────────────────────────────────────

  /** Reset the circuit state to |0...0> and clear the gate log. */
  reset(): this {
    this._resetState();
    this._log = [];
    return this;
  }

  /** Create an independent copy of this circuit (state + gate log). */
  clone(): QuantumCircuit {
    const copy = new QuantumCircuit(this._nQubits);
    copy._state = this._state.map(([re, im]) => [re, im]);
    copy._log = this._log.map((g) => ({ ...g, qubits: [...g.qubits], params: [...g.params] }));
    return copy;
  }

  // ── code generation ─────────────────────────────────────────────

  /** Generate a Qiskit (Python) script that reproduces this circuit. */
  toQiskit(): string {
    const lines: string[] = [
      'from qiskit import QuantumCircuit',
      '',
      `qc = QuantumCircuit(${this._nQubits})`,
      '',
    ];
    for (const g of this._log) {
      const qs = g.qubits.join(', ');
      if (g.params.length) {
        lines.push(`qc.${g.name}(${g.params.join(', ')}, ${qs})`);
      } else if (g.name === 'measure') {
        lines.push(`qc.measure(${qs}, ${qs})`);
      } else {
        lines.push(`qc.${g.name}(${qs})`);
      }
    }
    lines.push('', 'print(qc.draw())', '');
    return lines.join('\n');
  }

  /** Generate a Cirq (Python) script that reproduces this circuit. */
  toCirq(): string {
    const lines: string[] = [
      'import cirq',
      '',
      `qubits = cirq.LineQubit.range(${this._nQubits})`,
      'circuit = cirq.Circuit()',
      '',
    ];
    const cirqMap: Record<string, string> = {
      h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', t: 'T',
      cx: 'CNOT', cz: 'CZ', ccx: 'CCX', swap: 'SWAP',
    };
    for (const g of this._log) {
      const targets = g.qubits.map((q) => `qubits[${q}]`).join(', ');
      if (g.name === 'measure') {
        lines.push(`circuit.append(cirq.measure(${targets}, key='q${g.qubits[0]}'))`);
      } else if (g.name in cirqMap) {
        lines.push(`circuit.append(cirq.${cirqMap[g.name]}(${targets}))`);
      } else if (g.name === 'rx') {
        lines.push(`circuit.append(cirq.rx(${g.params[0]})(${targets}))`);
      } else if (g.name === 'ry') {
        lines.push(`circuit.append(cirq.ry(${g.params[0]})(${targets}))`);
      } else if (g.name === 'rz') {
        lines.push(`circuit.append(cirq.rz(${g.params[0]})(${targets}))`);
      }
    }
    lines.push('', 'print(circuit)', '');
    return lines.join('\n');
  }

  /** Serialise the circuit to a plain JSON-safe object. */
  toJSON(): object {
    return {
      nQubits: this._nQubits,
      gates: this._log.map((g) => ({
        name: g.name,
        qubits: g.qubits,
        ...(g.params.length ? { params: g.params } : {}),
      })),
      statevector: this._state.map(([re, im]) => {
        if (im === 0) return re;
        return [re, im];
      }),
    };
  }

  // ── internals ───────────────────────────────────────────────────

  /** Apply a named single-qubit gate from the lookup table. */
  private _applySingle(name: string, qubit: number): void {
    const mat = GATE_MATRICES[name];
    if (!mat) throw new Error(`Unknown gate: ${name}`);
    this._applyMatrix(mat, qubit);
  }

  /** Apply an arbitrary 2x2 unitary to a single qubit. */
  private _applyMatrix(mat: Mat2, qubit: number): void {
    this._assertQubit(qubit);
    const mask = 1 << (this._nQubits - 1 - qubit);
    for (let i = 0; i < this._dim; i++) {
      if (i & mask) continue; // process each pair once
      const j = i | mask;
      const a = this._state[i];
      const b = this._state[j];
      this._state[i] = cmulAdd(mat[0][0], a, mat[0][1], b);
      this._state[j] = cmulAdd(mat[1][0], a, mat[1][1], b);
    }
  }

  /** Reset state vector to |0...0>. */
  private _resetState(): void {
    for (let i = 0; i < this._dim; i++) this._state[i] = [0, 0];
    this._state[0] = [1, 0];
  }

  /** Throw if qubit index is out of range. */
  private _assertQubit(q: number): void {
    if (q < 0 || q >= this._nQubits) {
      throw new RangeError(`Qubit ${q} out of range [0, ${this._nQubits - 1}]`);
    }
  }
}
