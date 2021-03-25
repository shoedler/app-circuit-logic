import p5 from "p5"
import Gate from "./gate"
import Connector from "./shapes/connector"
import Edge from "./shapes/edge"
import { EState } from "./state"

export default interface ISimulator {
  simulate(): void,
}

export class SimulatedEdge extends Edge implements ISimulator {
  constructor(startConnector: Connector) {
    super(startConnector)
  }

  simulate = () => {
    let nextState: EState = this.startConnector.state
    this.endConnector.state = nextState
    this.state = nextState
  }
}

export class AndGate extends Gate implements ISimulator {
  constructor(pos: p5.Vector) {
    super(pos, '&', 70, 100, ['A', 'B'], ['Y'])
  }

  simulate = () => {
    let nextState: EState = (this.inputs[0].state == EState.log1 && this.inputs[1].state == EState.log1) ?
      EState.log1 : EState.log0
    this.outputs[0].state = nextState
    this.body.state = nextState
  }
}

export class OrGate extends Gate implements ISimulator {
  constructor(pos: p5.Vector) {
    super(pos, '≥1', 70, 100, ['A', 'B'], ['Y'])
  }

  simulate = () => {
    let nextState: EState = (this.inputs[0].state == EState.log1 || this.inputs[1].state == EState.log1) ?
      EState.log1 : EState.log0
    this.outputs[0].state = nextState
    this.body.state = nextState
  }
}

export class XorGate extends Gate implements ISimulator {
  constructor(pos: p5.Vector) {
    super(pos, '⊕', 70, 100, ['A', 'B'], ['Y'])
  }
  simulate = () => {
    let nextState: EState = (this.inputs[0].state == EState.log1 || this.inputs[1].state == EState.log1)
      && !(this.inputs[0].state == EState.log1 && this.inputs[1].state == EState.log1) ?
      EState.log1 : EState.log0
    this.outputs[0].state = nextState
    this.body.state = nextState
  }
}


export class Log1Gate extends Gate implements ISimulator {
  constructor(pos: p5.Vector) {
    super(pos, '1', 70, 70, [], ['Y'])
  }

  simulate = () => {
    this.outputs[0].state = EState.log1
    this.body.state = EState.log1
  }
}

export class CoilGate extends Gate implements ISimulator {
  constructor(pos: p5.Vector) {
    super(pos, '=', 70, 70, ['A'], [])
  }

  simulate = () => {
    let nextState: EState = this.inputs[0].state
    this.body.state = nextState
  }
}