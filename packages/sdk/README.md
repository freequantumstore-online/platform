# @freequantumstore/sdk

Quantum circuit simulator -- build, simulate, and export quantum circuits in TypeScript.

## Install

```bash
npm install @freequantumstore/sdk
```

## Quick start

```ts
import { QuantumCircuit } from '@freequantumstore/sdk/circuit';

const qc = new QuantumCircuit(2);
qc.h(0).cx(0, 1);
console.log(qc.getState());
// [
//   { basis: "00", amplitude: [0.707, 0], probability: 0.5 },
//   { basis: "11", amplitude: [0.707, 0], probability: 0.5 }
// ]
```

## Create a Bell pair

```ts
import { QuantumCircuit } from '@freequantumstore/sdk/circuit';

const bell = new QuantumCircuit(2);
bell.h(0);    // put qubit 0 in superposition
bell.cx(0, 1); // entangle qubit 0 and 1

console.log(bell.getProbabilities());
// [0.5, 0, 0, 0.5]  -- equal chance of |00> and |11>

const result = bell.measureAll();
console.log(result.toString(2).padStart(2, '0'));
// "00" or "11" (never "01" or "10")
```

## Run Grover's algorithm (2-qubit, searching for |11>)

```ts
import { QuantumCircuit } from '@freequantumstore/sdk/circuit';

const grover = new QuantumCircuit(2);

// Initialise uniform superposition
grover.h(0).h(1);

// Oracle: mark |11> with a phase flip (CZ)
grover.cz(0, 1);

// Diffusion operator
grover.h(0).h(1);
grover.x(0).x(1);
grover.cz(0, 1);
grover.x(0).x(1);
grover.h(0).h(1);

const counts = grover.sample(1000);
console.log(counts);
// { "11": ~1000 }  -- Grover amplifies the marked state
```

## Sample 1000 shots

```ts
const qc = new QuantumCircuit(3);
qc.h(0).cx(0, 1).cx(0, 2); // GHZ state

const counts = qc.sample(1000);
console.log(counts);
// { "000": ~500, "111": ~500 }
```

## Export to Qiskit

```ts
const qc = new QuantumCircuit(2);
qc.h(0).cx(0, 1);

console.log(qc.toQiskit());
// from qiskit import QuantumCircuit
//
// qc = QuantumCircuit(2)
//
// qc.h(0)
// qc.cx(0, 1)
//
// print(qc.draw())
```

## Export to Cirq

```ts
console.log(qc.toCirq());
// import cirq
//
// qubits = cirq.LineQubit.range(2)
// circuit = cirq.Circuit()
//
// circuit.append(cirq.H(qubits[0]))
// circuit.append(cirq.CNOT(qubits[0], qubits[1]))
//
// print(circuit)
```

## Use in the browser (ESM)

```html
<script type="module">
  import { QuantumCircuit } from 'https://esm.sh/@freequantumstore/sdk/circuit';

  const qc = new QuantumCircuit(3);
  qc.h(0).cx(0, 1).cx(0, 2);
  console.log(qc.sample(1000));
</script>
```

## API

### `new QuantumCircuit(nQubits)`

Create a circuit with 1--24 qubits, initialised to |0...0>.

### Single-qubit gates

`h(q)`, `x(q)`, `y(q)`, `z(q)`, `s(q)`, `t(q)` -- standard gates.

`rx(q, theta)`, `ry(q, theta)`, `rz(q, theta)` -- rotation gates (radians).

All return `this` for chaining.

### Multi-qubit gates

`cx(control, target)` -- CNOT.
`cz(control, target)` -- Controlled-Z.
`swap(q1, q2)` -- SWAP.
`ccx(c1, c2, target)` -- Toffoli (CCX).

### Measurement

`measure(qubit)` -- Measure one qubit (collapses state), returns `0 | 1`.
`measureAll()` -- Measure all qubits, returns integer.
`sample(shots)` -- Sample distribution without collapse, returns `Record<string, number>`.

### State inspection

`getState()` -- Non-zero state entries with basis label, amplitude, probability.
`getProbabilities()` -- Born-rule probability for every basis state.
`getStatevector()` -- Raw `[real, imag][]` copy of the state vector.

### Utilities

`reset()` -- Reset to |0...0> and clear gate log.
`clone()` -- Independent deep copy.
`toQiskit()` -- Python code for Qiskit.
`toCirq()` -- Python code for Cirq.
`toJSON()` -- Serialisable object (gates + statevector).

## License

MIT
