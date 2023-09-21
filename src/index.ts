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

    // Create starter circuit
    createStarterCircuit();
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
        inputGates.forEach((g, i) => g.outputs.force(0, ins[i])); // Force 0, because an input gate has exactly one output
        this.packedGates.forEach((g: Gate) => g.run());
        outputGates.forEach((g, i) => (outs[i] = g.inputs.read(0))); // Read 0, because an output gate has exactly one input
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

    const edges = new Set<Edge>();
    packedGates.forEach(g => {
      [...g.inputs.connectors, ...g.outputs.connectors].forEach(connector => {
        connector.connections.forEach(edge => {
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
  Label: (label?: string) =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Label",
      inputs: [],
      outputs: [],
      color: "black",
      init: function (self) {
        (self as any).name =
          label ?? prompt("Enter a name for the label", "Label");
      },
      logic: function (_, outs, self) {
        // Nothing to do
      },
    }),
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
  Button: () =>
    new Gate({
      bounds: Ui.gatesContainer,
      name: "Button",
      inputs: [],
      outputs: ["C"],
      color: "darkgreen",
      init: function (self) {
        this.pressing = false;
        self.addEventListener("mousedown", _ => (this.pressing = true));
        self.addEventListener("mouseup", _ => (this.pressing = false));
        self.classList.add("button");
      },
      logic: function (_, outs, self) {
        outs[0] = this.pressing;
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

const createStarterCircuit = () => {
  clearCircuit(true);

  State.gates = [
    DEFAULT_GATE_BUILDERS.Button(),
    DEFAULT_GATE_BUILDERS.Button(),
    DEFAULT_GATE_BUILDERS.Or(),
    DEFAULT_GATE_BUILDERS.Not(),
    DEFAULT_GATE_BUILDERS.Or(),
    DEFAULT_GATE_BUILDERS.Not(),
    DEFAULT_GATE_BUILDERS.Lamp(),
    DEFAULT_GATE_BUILDERS.Lamp(),
    DEFAULT_GATE_BUILDERS.Label("Set"),
    DEFAULT_GATE_BUILDERS.Label("Reset"),
    DEFAULT_GATE_BUILDERS.Label("Q"),
    DEFAULT_GATE_BUILDERS.Label("Q'"),
  ];

  const svg = (EdgeDragHandler as any)["_svg"] as SVGElement;

  const [
    button1,
    button2,
    or1,
    not1,
    or2,
    not2,
    lamp1,
    lamp2,
    labelSet,
    labelReset,
    labelQ,
    labelQ_,
  ] = State.gates;

  // Button1 -> Or 1 & Button2 -> Or 2
  let edge = button1.outputs.connectors[0].newEdge(svg);
  or1.inputs.connectors[0].endEdge(edge);
  edge = button2.outputs.connectors[0].newEdge(svg);
  or2.inputs.connectors[1].endEdge(edge);

  // OR 1 -> NOT 1 & OR 2 -> NOT 2
  edge = or1.outputs.connectors[0].newEdge(svg);
  not1.inputs.connectors[0].endEdge(edge);
  edge = or2.outputs.connectors[0].newEdge(svg);
  not2.inputs.connectors[0].endEdge(edge);

  // NOT 1 -> Lamp 1 & NOT 2 -> Lamp 2
  edge = not1.outputs.connectors[0].newEdge(svg);
  lamp1.inputs.connectors[0].endEdge(edge);
  edge = not2.outputs.connectors[0].newEdge(svg);
  lamp2.inputs.connectors[0].endEdge(edge);

  // NOT 1 -> OR 2 & NOT 2 -> OR 1
  edge = not1.outputs.connectors[0].newEdge(svg);
  or2.inputs.connectors[0].endEdge(edge);
  edge = not2.outputs.connectors[0].newEdge(svg);
  or1.inputs.connectors[1].endEdge(edge);

  const setPos = (el: HTMLElement, pos: { x: number; y: number }) => {
    const ofsX =
      el.clientLeft - Ui.gatesContainer.clientLeft - el.clientWidth / 2;
    const ofsY =
      el.clientTop - Ui.gatesContainer.clientTop - el.clientHeight / 2;
    el.style.position = "absolute";
    el.style.transform = `translate(${ofsX + pos.x}px, ${ofsY + pos.y}px)`;
  };

  // Distribute gates on the screen
  setPos(button1, { x: 50, y: 60 });
  setPos(button2, { x: 50, y: 190 });

  setPos(or1, { x: 190, y: 40 });
  setPos(or2, { x: 190, y: 210 });

  setPos(not1, { x: 260, y: 70 });
  setPos(not2, { x: 260, y: 180 });

  setPos(lamp1, { x: 370, y: 50 });
  setPos(lamp2, { x: 370, y: 200 });

  setPos(labelSet, { x: 90, y: 40 });
  setPos(labelReset, { x: 90, y: 170 });

  setPos(labelQ, { x: 380, y: 30 });
  setPos(labelQ_, { x: 380, y: 180 });

  State.gates.forEach(g => g.redraw());
};
