import {
  EdgeDragHandler,
  GateDragHandler,
  IDragEventHandler,
} from "./dragEventHandler";
import { Gate, GateType } from "./gate";
import { Connector, ConnectorCollection } from "./connector";
import { Edge } from "./edge";

class Ui {
  public static readonly gatesContainer = document.querySelector(
    ".gates"
  ) as HTMLDivElement;
  public static readonly edgesContainer = document.querySelector(
    ".edges"
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

class State {
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
  document.addEventListener("DOMContentLoaded", _ => {
    Ui.registerCustomElements();

    // Create gate builder buttons
    Object.entries(DEFAULT_GATE_BUILDERS).forEach(([name, builder]) =>
      addGateBuilderButton(name, builder)
    );

    // Create clear-circuit button
    const clearButton = document.createElement("button");
    clearButton.textContent = "🗑️ Clear circuit";
    clearButton.addEventListener("click", _ => clearCircuit());
    Ui.controlsContainer.appendChild(clearButton);

    // Create pack-circuit button
    const packButton = document.createElement("button");
    packButton.textContent = "📦 Pack circuit";
    packButton.addEventListener("click", _ => packCircuit());
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
      State.gates.forEach(g => g.run());

      simulationTimer = performance.now();
    }, targetSimulationTimeMs);

    // Setup drag handler
    document.addEventListener("mousedown", (e: MouseEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY);

      if (element instanceof Connector) {
        State.currentDragHandler = new EdgeDragHandler();
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

    EdgeDragHandler.attach({ parent: Ui.edgesContainer });
  });
})();

const removeGate = (gate: Gate) => {
  gate.dispose();
  State.gates.splice(State.gates.indexOf(gate), 1);
  State.gates.forEach(g => g.redraw()); // Other gates in the DOM might shift, so we need to redraw the edges
};

const clearCircuit = (force: boolean = false) => {
  if (!force && !confirm("Are you sure you want to clear the circuit?")) return;
  State.gates.forEach(g => g.dispose());
  State.gates.length = 0;
};

const packCircuit = () => {
  const inputGates = State.gates.filter(g => g.gateType === GateType.input);
  const outputGates = State.gates.filter(g => g.gateType === GateType.output);

  if (!inputGates.length && !outputGates.length) {
    alert("Cannot pack circuit with no inputs or outputs");
    return;
  }

  // Remove all gates from the circuit, but keep a reference to them for the newly packed gate
  const packedGates: Gate[] = [];
  Object.assign(packedGates, State.gates); // Keep reference to gates
  State.gates.forEach(g => g.detach());

  // Reset state, to get fresh Ids and remove the gate references
  State.reset();

  const name = prompt("Enter a name for the packed gate", "Packed");

  // Create the packed gate
  const packedGateBuilder = () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name,
      inputs: inputGates.map(i => i.name),
      outputs: outputGates.map(o => o.name),
      color: "gray",
      init: function (self) {
        this.packedGates = packedGates;
      },
      logic: function (ins, outs, self) {
        // Map this gate's inputs to the packed gates' inputs, run logic, then map outputs back
        // to this gate's outputs - easy!
        inputGates.forEach((g, i) => g.outputs.force(i, ins[i]));
        this.packedGates.forEach((g: Gate) => g.run());
        outputGates.forEach((g, i) => (outs[i] = g.inputs.read(i)));
      },
    });

  // Add the packed gate to the circuit, and add a builder button
  State.gates.push(packedGateBuilder());
  const builderButton = addGateBuilderButton(name, packedGateBuilder);

  // Add ability to unpack the gate
  builderButton.addEventListener("dblclick", _ => {
    if (
      !confirm(
        "Are you sure you want to unpack this gate? This will clear the current circuit"
      )
    )
      return;

    clearCircuit(true);

    packedGates.forEach(g => Ui.gatesContainer.appendChild(g));
    State.gates.push(...packedGates);

    // TODO: Refactor so that we don't have to access private members via "as any".
    //       Maybe add an interface "IEdgeRetrievable" with a method "getEdges(): Edge[]"?
    const edges = new Set<Edge>();
    packedGates.forEach(g => {
      [
        ...(g.inputs as any)["_connectors"],
        ...(g.outputs as any)["_connectors"],
      ].forEach((connector: any) => {
        connector["_connections"].forEach((edge: Edge) => {
          edges.add(edge);
        });
      });
    });

    // TODO: Refactor so that we don't have to access private members via "as any".
    //       Getter for "_svg"?
    Array.from(edges).forEach(e =>
      (EdgeDragHandler as any)["_svg"].appendChild(e.path)
    );
  });
};

const addGateBuilderButton = (name: string, builder: () => Gate) => {
  const button = document.createElement("button");

  button.textContent = "➕ " + name;
  button.addEventListener("click", _ => State.gates.push(builder()));
  Ui.builderButtonsContainer.appendChild(button);

  return button;
};

const DEFAULT_GATE_BUILDERS = {
  And: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "AND",
      inputs: ["A", "B"],
      outputs: ["C"],
      logic: (ins, outs) => {
        outs[0] = ins[0] && ins[1];
      },
    }),
  Or: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "OR",
      inputs: ["A", "B"],
      outputs: ["C"],
      color: "turquoise",
      logic: (ins, outs) => {
        outs[0] = ins[0] || ins[1];
      },
    }),
  Not: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "NOT",
      inputs: ["A"],
      outputs: ["C"],
      color: "red",
      logic: (ins, outs) => {
        outs[0] = !ins[0];
      },
    }),
  Xor: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "XOR",
      inputs: ["A", "B"],
      outputs: ["C"],
      color: "orange",
      logic: function (ins, outs, self) {
        outs[0] = ins[0] !== ins[1];
      },
    }),
  Switch: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Switch",
      inputs: [],
      outputs: ["C"],
      color: "darkgreen",
      init: function (self) {
        this.clicked = false;
        self.addEventListener("click", _ => (this.clicked = !this.clicked));
        self.classList.add("switch");
      },
      logic: function (_, outs, self) {
        outs[0] = this.clicked;
      },
    }),
  True: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "1",
      inputs: [],
      outputs: ["C"],
      color: "green",
      logic: (ins, outs) => {
        outs[0] = true;
      },
    }),
  "1Hz Clock": () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Clock",
      info: "1Hz",
      inputs: [],
      outputs: ["C"],
      color: "darkgreen",
      logic: (ins, outs) => {
        outs[0] = new Date().getMilliseconds() % 1000 < 500;
      },
    }),
  "2Hz Clock": () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Clock",
      info: "2Hz",
      inputs: [],
      outputs: ["C"],
      color: "darkgreen",
      logic: (ins, outs) => {
        outs[0] = new Date().getMilliseconds() % 500 < 250;
      },
    }),
  "10Hz Clock": () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Clock",
      info: "10Hz",
      inputs: [],
      outputs: ["C"],
      color: "darkgreen",
      logic: (ins, outs) => {
        outs[0] = new Date().getMilliseconds() % 100 < 50;
      },
    }),
  Probe: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Probe",
      info: State.nextProbeGateMarker(),
      inputs: ["A"],
      outputs: ["C"],
      color: "gray",
      init: function (self) {
        this.lastOn = null;
        this.lastOff = null;
      },
      logic: function (ins, outs, self) {
        if (ins[0] && this.lastOn === null) {
          this.lastOn = Date.now();
        } else if (!ins[0] && this.lastOn !== null) {
          console.log(
            `${self.name} ${self.info} on for  ${Date.now() - this.lastOn}ms`
          );
          this.lastOn = null;
        }

        if (!ins[0] && this.lastOff === null) {
          this.lastOff = Date.now();
        } else if (ins[0] && this.lastOff !== null) {
          console.log(
            `${self.name} ${self.info} off for ${Date.now() - this.lastOff}ms`
          );
          this.lastOff = null;
        }

        outs[0] = ins[0];
      },
    }),
  Lamp: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "💡",
      inputs: ["A"],
      outputs: [],
      color: "gray",
      init: function (self) {
        this.on = false;
      },
      logic: function (ins, _, self) {
        if (ins[0] !== this.on) {
          this.on = ins[0];
          self.classList.toggle("lamp-on", this.on);
        }
      },
    }),
  Counter: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Counter",
      info: "0",
      inputs: ["A"],
      outputs: [],
      color: "gray",
      init: function (self) {
        this.on = false;
      },
      logic: function (ins, _, self) {
        if (ins[0] !== this.on) {
          this.on = ins[0];

          if (this.on) {
            self.info = (parseInt(self.info) + 1).toString();
          }
        }
      },
    }),
  Input: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "In",
      info: State.nextInputGateId(),
      inputs: [],
      outputs: ["C"],
      color: "gray",
      gateType: GateType.input,
      logic: function (_, outs, self) {
        // Nothing to do
      },
    }),
  Output: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Out",
      info: State.nextOutputGateId(),
      inputs: ["A"],
      outputs: [],
      color: "gray",
      gateType: GateType.output,
      logic: function (ins, _, self) {
        // Nothing to do
      },
    }),
};
