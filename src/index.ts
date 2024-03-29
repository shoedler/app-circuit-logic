import { createBlueprint, parseBlueprint } from "./blueprint";
import { Connector, ConnectorCollection } from "./connector";
import { DEFAULT_GATE_BUILDERS } from "./defaultGates";
import {
  EdgeDragHandler,
  GateDragHandler,
  IDragEventHandler,
} from "./dragEventHandler";
import { Edge } from "./edge";
import { Gate, GateType } from "./gate";

export class Ui {
  public static readonly gatesContainer = document.querySelector(
    ".gates"
  ) as HTMLDivElement;
  public static readonly simSpeedParagraph = document.querySelector(
    ".simulation-speedometer"
  ) as HTMLParagraphElement;
  public static readonly builderButtonsContainer = document.querySelector(
    ".builder-buttons"
  ) as HTMLDivElement;
  public static readonly controlsContainer = document.querySelector(
    ".controls"
  ) as HTMLDivElement;
  public static readonly origin = document.querySelector(
    ".origin"
  ) as HTMLDivElement;
  public static readonly edgesSvg = document.querySelector(
    ".edges > svg"
  ) as SVGElement;

  private constructor() {}

  public static registerCustomElements() {
    // Register custom elements
    customElements.define("cl-gate", Gate, { extends: "div" });
    customElements.define("cl-gate-connector", Connector, {
      extends: "div",
    });
    customElements.define("cl-gate-connector-collection", ConnectorCollection, {
      extends: "div",
    });
  }
}

export class State {
  public static readonly config = {
    probeGateMarkers: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤"] as const,
    inputNames: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const,
    outputNames: ["Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"] as const,
  };

  public static probeGateIndex: number = 0;
  public static inputGateIndex: number = 0;
  public static outputGateIndex: number = 0;
  public static gates: Gate[] = [];
  public static currentDragHandler: IDragEventHandler = null;

  private constructor() {}

  private static getSuffix = (index: number, length: number) =>
    Math.floor((index - 1) / length) > 0
      ? Math.floor((index - 1) / length)
      : "";

  public static nextProbeGateMarker = () =>
    State.config.probeGateMarkers[
      State.probeGateIndex++ % State.config.probeGateMarkers.length
    ] +
    State.getSuffix(State.probeGateIndex, State.config.probeGateMarkers.length);

  public static nextInputGateId = () =>
    State.config.inputNames[
      State.inputGateIndex++ % State.config.inputNames.length
    ] + State.getSuffix(State.inputGateIndex, State.config.inputNames.length);

  public static nextOutputGateId = () =>
    State.config.outputNames[
      State.outputGateIndex++ % State.config.outputNames.length
    ] + State.getSuffix(State.outputGateIndex, State.config.outputNames.length);

  public static reset = () => {
    State.probeGateIndex = 0;
    State.inputGateIndex = 0;
    State.outputGateIndex = 0;
    State.gates.length = 0;
    State.currentDragHandler = null;
  };
}

(() => {
  document.addEventListener("DOMContentLoaded", (_) => {
    Ui.registerCustomElements();

    // Create gate builder buttons
    Object.entries(DEFAULT_GATE_BUILDERS).forEach(([name, builder]) =>
      addGateBuilderButton(name, builder)
    );

    // Create clear-circuit button
    const clearButton = document.createElement("button");
    clearButton.textContent = "🗑️ Clear circuit";
    clearButton.addEventListener("click", (_) => clearCircuit());
    Ui.controlsContainer.appendChild(clearButton);

    // Create pack-circuit button
    const packButton = document.createElement("button");
    packButton.textContent = "📦 Pack circuit";
    packButton.addEventListener("click", (_) => packCircuit());
    Ui.controlsContainer.appendChild(packButton);

    // Create trashbin zone
    const trashbinDiv = document.createElement("div");
    trashbinDiv.classList.add("trashbin");
    trashbinDiv.textContent = "Drop here to delete";
    trashbinDiv.addEventListener("trashed", (e: CustomEvent) =>
      removeGate(e.detail)
    );
    Ui.controlsContainer.appendChild(trashbinDiv);

    // Start simulation
    let simulationTimer = performance.now();
    let measurements: number[] = [];
    let smoothingTimer = performance.now();

    const smoothingTimeMs = 100;
    const targetSimulationTimeMs = 1000 / 200;

    setInterval(() => {
      const simulationTimeMs = performance.now() - simulationTimer;
      const simulationTicks = Math.round(1000 / simulationTimeMs);
      measurements.push(simulationTicks);

      if (smoothingTimer + smoothingTimeMs < performance.now()) {
        Ui.simSpeedParagraph.textContent = `${Math.round(
          measurements.reduce((a, b) => a + b, 0) / measurements.length
        )} ticks/s`;
        measurements = [];
        smoothingTimer = performance.now();
      }

      // Run simulation
      State.gates.forEach((g) => g.run());

      simulationTimer = performance.now();
    }, targetSimulationTimeMs);

    // Setup drag handler
    document.addEventListener("mousedown", (e: MouseEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY);

      if (element instanceof Connector) {
        State.currentDragHandler = new EdgeDragHandler(Ui.edgesSvg);
      } else if (
        element instanceof Gate ||
        element.classList.contains("gate-label")
      ) {
        State.currentDragHandler = new GateDragHandler();
      } else return;

      State.currentDragHandler.onStart(e);
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (State.currentDragHandler) {
        State.currentDragHandler.onDrag(e);
      }
    });

    document.addEventListener("mouseup", (e: MouseEvent) => {
      if (State.currentDragHandler) {
        State.currentDragHandler.onDrop(e);
        State.currentDragHandler = null;
      }
    });

    // Create starter circuit
    createStarterCircuit();
  });
})();

const removeGate = (gate: Gate) => {
  gate.dispose();
  State.gates.splice(State.gates.indexOf(gate), 1);
  State.gates.forEach((g) => g.redraw()); // Other gates in the DOM might shift, so we need to redraw the edges
};

const clearCircuit = (force: boolean = false) => {
  if (!force && !confirm("Are you sure you want to clear the circuit?")) return;
  State.gates.forEach((g) => g.dispose());
  State.gates.length = 0;
};

const packCircuit = () => {
  const inputGates = State.gates.filter((g) => g.gateType === GateType.input);
  const outputGates = State.gates.filter((g) => g.gateType === GateType.output);

  if (!inputGates.length && !outputGates.length) {
    alert("Cannot pack circuit with no inputs or outputs");
    return;
  }

  // Remove all gates from the circuit, but keep a reference to them for the newly packed gate
  const packedGates: Gate[] = [];
  Object.assign(packedGates, State.gates); // Keep reference to gates
  State.gates.forEach((g) => g.detach());

  // Reset state, to get fresh Ids and remove the gate references
  State.reset();

  const name = prompt("Enter a name for the packed gate", "Packed");

  // Create the packed gate
  const packedGateBuilder = () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name,
      inputs: inputGates.map((i) => i.name),
      outputs: outputGates.map((o) => o.name),
      color: "gray",
      init: function (self) {
        this.packedGates = packedGates;
      },
      logic: function (ins, outs, self) {
        // Map this gate's inputs to the packed gates' inputs, run logic, then map outputs back
        // to this gate's outputs - easy!
        inputGates.forEach((g, i) => g.outputs.force(0, ins[i])); // Force 0, because an input gate has exactly one output
        this.packedGates.forEach((g: Gate) => g.run());
        outputGates.forEach((g, i) => (outs[i] = g.inputs.read(0))); // Read 0, because an output gate has exactly one input
      },
    });

  // Add the packed gate to the circuit, and add a builder button
  addGate(packedGateBuilder());
  const builderButton = addGateBuilderButton(name, packedGateBuilder);

  // Add ability to unpack the gate
  builderButton.addEventListener("dblclick", (_) => {
    if (
      !confirm(
        "Are you sure you want to unpack this gate? This will clear the current circuit"
      )
    )
      return;

    clearCircuit(true);

    packedGates.forEach((g) => Ui.gatesContainer.appendChild(g));
    State.gates.push(...packedGates);

    const edges = new Set<Edge>();
    packedGates.forEach((g) => {
      [...g.inputs.connectors, ...g.outputs.connectors].forEach((connector) => {
        connector.connections.forEach((edge) => {
          edges.add(edge);
        });
      });
    });

    // TODO: Refactor so that we don't have to access private members via "as any".
    //       Getter for "_svg"?
    Array.from(edges).forEach((e) =>
      (EdgeDragHandler as any)["_svg"].appendChild(e.path)
    );
  });
};

const addGateBuilderButton = (name: string, builder: () => Gate) => {
  const button = document.createElement("button");

  button.textContent = "➕ " + name;
  button.addEventListener("click", (_) => {
    addGate(builder());
  });
  Ui.builderButtonsContainer.appendChild(button);

  return button;
};

const addGate = (gate: Gate) => {
  setPos(gate, { x: 0, y: 0 });
  State.gates.push(gate);
};

export const setPos = (el: Gate, pos: { x: number; y: number }) => {
  const x = el.offsetLeft;
  const y = el.offsetTop;
  el.style.transform = `translate(${x + pos.x + Ui.origin.offsetLeft}px, ${
    y + pos.y + Ui.origin.offsetTop
  }px)`;
};

export const getPos = (el: Gate): { x: number; y: number } => {
  const x = el.offsetLeft;
  const y = el.offsetTop;
  return { x: x - Ui.origin.offsetLeft, y: y - Ui.origin.offsetTop };
};

const createStarterCircuit = () => {
  clearCircuit(true);

  const adderBlueprint = createBlueprint({
    declaration: {
      label: {
        type: "Label",
        args: [
          "This is a 1 bit adder circuit, press the 'Pack circuit'\n button to pack this circuit into a gate",
        ],
      },
      inputA: {
        type: "Input",
        args: ["A"],
      },
      inputB: {
        type: "Input",
        args: ["B"],
      },
      inputCarry: {
        type: "Input",
        args: ["Carry In"],
      },
      outputSum: {
        type: "Output",
        args: ["Sum"],
      },
      outputCarry: {
        type: "Output",
        args: ["Carry Out"],
      },
      xor1: "Xor",
      xor2: "Xor",
      and1: "And",
      and2: "And",
      or1: "Or",
    },
    positions: {
      inputA: { x: 0, y: 50 },
      inputB: { x: 0, y: 100 },
      inputCarry: { x: 0, y: 150 },
      outputSum: { x: 450, y: 125 },
      outputCarry: { x: 450, y: 75 },
      xor1: { x: 125, y: 0 },
      xor2: { x: 200, y: 175 },
      and1: { x: 250, y: 50 },
      and2: { x: 250, y: 100 },
      or1: { x: 350, y: 100 },
      label: { x: 350, y: 0 },
    },
    connections: [
      "inputA to xor1:A",
      "inputA to and2:A",
      "inputB to xor1:B",
      "inputB to and2:B",
      "inputCarry to xor2:B",
      "inputCarry to and1:B",
      "xor1 to xor2:A",
      "xor1 to and1:A",
      "and1 to or1:A",
      "and2 to or1:B",
      "xor2 to outputSum",
      "or1 to outputCarry",
    ],
  });

  State.gates = parseBlueprint(Ui.edgesSvg, adderBlueprint);
  State.gates.forEach((g) => g.redraw());
};
