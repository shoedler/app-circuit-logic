import {
  EdgeDragHandler,
  GateDragHandler,
  IDragEventHandler,
} from "./dragEventHandler";
import { Gate, GateType } from "./gate";
import { Connector, ConnectorCollection } from "./connector";

const CONFIG = {
  probeGateMarkers: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤"],
  inputNames: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  outputNames: ["Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
};

const STATE = {
  probeGateIndex: 0,
  inputGateIndex: 0,
  outputGateIndex: 0,
  gates: [] as Gate[],
};

const getSuffix = (index: number, length: number) =>
  Math.floor(index / length) > 0 ? Math.floor(index / length) : "";

const nextProbeGateMarker = () =>
  CONFIG.probeGateMarkers[
    STATE.probeGateIndex++ % CONFIG.probeGateMarkers.length
  ] + getSuffix(STATE.probeGateIndex, CONFIG.probeGateMarkers.length);

const nextInputGateId = () =>
  CONFIG.inputNames[STATE.inputGateIndex++ % CONFIG.inputNames.length] +
  getSuffix(STATE.inputGateIndex, CONFIG.inputNames.length);

const nextOutputGateId = () =>
  CONFIG.outputNames[STATE.outputGateIndex++ % CONFIG.outputNames.length] +
  getSuffix(STATE.outputGateIndex, CONFIG.outputNames.length);

(() => {
  document.addEventListener("DOMContentLoaded", _ => {
    const gatesContainer = document.querySelector(".gates") as HTMLDivElement;
    const edgesContainer = document.querySelector(".edges") as HTMLDivElement;
    const simSpeedometer = document.querySelector(
      ".simulation-speedometer"
    ) as HTMLParagraphElement;
    const builderButtonsContainer = document.querySelector(
      ".builder-buttons"
    ) as HTMLDivElement;
    const controlsContainer = document.querySelector(
      ".controls"
    ) as HTMLDivElement;

    // Register custom elements
    customElements.define("cl-gate", Gate, { extends: "div" });
    customElements.define("cl-gate-connector", Connector, {
      extends: "div",
    });
    customElements.define("cl-gate-connector-collection", ConnectorCollection, {
      extends: "div",
    });

    // Create gate builder buttons
    const gateBuilders = getGateBuilders(gatesContainer);

    Object.entries(gateBuilders).forEach(([name, builder]) => {
      const button = document.createElement("button");
      button.textContent = "➕ " + name;
      button.addEventListener("click", _ => STATE.gates.push(builder()));
      builderButtonsContainer.appendChild(button);
    });

    // Create control buttons
    const clearButton = document.createElement("button");
    clearButton.textContent = "🗑️ Clear circuit";
    clearButton.addEventListener("click", _ => {
      if (!confirm("Are you sure you want to clear the circuit?")) return;
      STATE.gates.forEach(g => g.dispose());
      STATE.gates.length = 0;
    });
    controlsContainer.appendChild(clearButton);

    const packButton = document.createElement("button");
    packButton.textContent = "📦 Pack circuit";
    packButton.addEventListener("click", _ => {
      const inputs = STATE.gates.filter(g => g.gateType === GateType.input);
      const outputs = STATE.gates.filter(g => g.gateType === GateType.output);

      if (!inputs.length && !outputs.length) {
        alert("Cannot pack circuit with no inputs or outputs");
        return;
      }

      // Remove all gates from the circuit, but keep a reference to them for the new packed gate
      const packedGates: Gate[] = [];
      Object.assign(packedGates, STATE.gates); // Keep reference to gates
      STATE.gates.forEach(g => g.pack());
      STATE.gates.length = 0;

      // Create the packed gate
      const packedGate = new Gate({
        bounds: gatesContainer,
        name: "Packed",
        inputs: inputs.map(i => i.name),
        outputs: outputs.map(o => o.name),
        color: "gray",
        init: function (self) {
          this.packedGates = packedGates;
        },
        logic: function (ins, outs, self) {
          for (let i = 0; i < ins.length; i++) {
            const packedInputGate = inputs[i];
            packedInputGate.outputs.fromBoolArray([ins[i]]);
          }

          // Run the packed gates
          this.packedGates.forEach((g: Gate) => g.run());

          for (let i = 0; i < outs.length; i++) {
            const packedOutputGate = outputs[i];
            outs[i] = packedOutputGate.inputs.toBoolArray()[0];
          }
        },
      });

      STATE.gates.push(packedGate);
    });
    controlsContainer.appendChild(packButton);

    const trashbinDiv = document.createElement("div");
    trashbinDiv.classList.add("trashbin");
    trashbinDiv.textContent = "Drop here to delete";
    controlsContainer.appendChild(trashbinDiv);

    // Start simulation
    let simulationTimer = performance.now();
    setInterval(() => {
      const simulationTime = performance.now() - simulationTimer;
      const simulationTicks = Math.round(1000 / simulationTime);
      simSpeedometer.textContent = `${simulationTicks} ticks/s`;

      STATE.gates.forEach(g => g.run());

      simulationTimer = performance.now();
    }, 1000 / 120);

    // Setup drag handler
    let currentDragHandler: IDragEventHandler = null;

    document.addEventListener("mousedown", (e: MouseEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY);

      if (element instanceof Connector) {
        currentDragHandler = new EdgeDragHandler();
      } else if (
        element instanceof Gate ||
        element.classList.contains("gate-label")
      ) {
        currentDragHandler = new GateDragHandler();
      } else return;

      currentDragHandler.onStart(e);
    });
    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (currentDragHandler) {
        currentDragHandler.onDrag(e);
      }
    });
    document.addEventListener("mouseup", (e: MouseEvent) => {
      if (currentDragHandler) {
        currentDragHandler.onDrop(e);
        currentDragHandler = null;
      }
    });

    EdgeDragHandler.attach({ attachee: edgesContainer });
  });
})();

const getGateBuilders = (
  container: HTMLDivElement
): { [key: string]: () => Gate } => {
  return {
    And: () =>
      new Gate({
        bounds: container,
        name: "AND",
        inputs: ["A", "B"],
        outputs: ["C"],
        logic: (ins, outs) => {
          outs[0] = ins[0] && ins[1];
        },
      }),
    Or: () =>
      new Gate({
        bounds: container,
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
        bounds: container,
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
        bounds: container,
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
        bounds: container,
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
        bounds: container,
        name: "1",
        inputs: [],
        outputs: ["C"],
        color: "green",
        logic: (ins, outs) => {
          outs[0] = true;
        },
      }),
    "2Hz Clock": () =>
      new Gate({
        bounds: container,
        name: "2Hz",
        inputs: [],
        outputs: ["C"],
        color: "darkgreen",
        logic: (ins, outs) => {
          outs[0] = new Date().getMilliseconds() % 500 < 250;
        },
      }),
    "1Hz Clock": () =>
      new Gate({
        bounds: container,
        name: "1Hz",
        inputs: [],
        outputs: ["C"],
        color: "darkgreen",
        logic: (ins, outs) => {
          outs[0] = new Date().getMilliseconds() % 1000 < 500;
        },
      }),
    Probe: () =>
      new Gate({
        bounds: container,
        name: nextProbeGateMarker() + " Probe",
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
            console.log(`${self.name} on for  ${Date.now() - this.lastOn}ms`);
            this.lastOn = null;
          }

          if (!ins[0] && this.lastOff === null) {
            this.lastOff = Date.now();
          } else if (ins[0] && this.lastOff !== null) {
            console.log(`${self.name} off for ${Date.now() - this.lastOff}ms`);
            this.lastOff = null;
          }

          outs[0] = ins[0];
        },
      }),
    Lamp: () =>
      new Gate({
        bounds: container,
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
    Input: () =>
      new Gate({
        bounds: container,
        name: "In " + nextInputGateId(),
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
        bounds: container,
        name: "Out " + nextOutputGateId(),
        inputs: ["A"],
        outputs: [],
        color: "gray",
        gateType: GateType.output,
        logic: function (ins, _, self) {
          // Nothing to do
        },
      }),
  };
};
