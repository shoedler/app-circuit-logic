import { app as p, IAppContext } from "./index"
import { ShapeOffset } from "./shapes/shape"
import { EState } from "./state"
import Box from "./shapes/box"
import Connector, { InputConnector, OutputConnector } from "./shapes/connector"
import Gate from "./gate"
import { SimulatedEdge } from "./simulators"

export interface IAction {
  onMousePressed(o: IAppContext): void,
  onMouseDragged(o: IAppContext): void,
  onMouseReleased(o: IAppContext): void,
  additionalDraw(): void;
}

export type TActionContext = {
  gate: Gate,
  component: InputConnector | OutputConnector | Box
}

export function getAction(context: TActionContext): IAction {
  if (!context) return null
  if (context.component instanceof Box) return new ActionMoveGate(context)
  if (context.component instanceof Connector) return new ActionMakeEdge(context)
  return null
}

class ActionMoveGate implements IAction {
  ctx: TActionContext
  offset: ShapeOffset = null

  constructor(context: TActionContext) {
    if (!(context.component instanceof Box)) throw "ActionMoveGate requires a 'Box' component"
    this.ctx = context
  }

  onMousePressed = () => {
    this.offset = this.ctx.component.offsets(p.mouseX, p.mouseY)
    this.ctx.component.state = EState.selected
    return true
  }

  onMouseDragged = () => this.ctx.gate.pos = p.createVector(p.mouseX - this.offset.x, p.mouseY - this.offset.y)
  onMouseReleased = () => this.ctx.component.state = EState.idle
  additionalDraw = () => { }
}

class ActionMakeEdge implements IAction {
  ctx: TActionContext
  edge: SimulatedEdge
  hoverConnector: Connector

  constructor(context: TActionContext) {
    if (!(context.component instanceof Connector)) throw "ActionMakeEdge requires a 'Connector' component"
    this.ctx = context
  }

  private getHoveredConnector = (o: IAppContext): Connector | null => {
    let ctx = o.getHovered(o.gates)
    return (ctx == null) ? null
      : (this.ctx.gate === ctx.gate) ? null // Not valid if it's the same gate
        : (!(ctx.component instanceof Connector)) ? null // Not valid if it's not a connector
          : (this.ctx.component === ctx.component) ? null // Not valid if it's the same connector
            : (this.ctx.component.constructor === ctx.component.constructor) ? null // Not valid if it's the same type
              : ctx.component
  }

  onMousePressed = () => {
    this.edge = new SimulatedEdge(this.ctx.component as Connector)
    this.ctx.component.state = EState.selected
    return true
  }

  onMouseDragged = (o: IAppContext) => {
    if (this.hoverConnector) this.hoverConnector.state = EState.idle
    this.hoverConnector = this.getHoveredConnector(o)
    if (this.hoverConnector) this.hoverConnector.state = EState.selected

    this.edge.trace(p.mouseX, p.mouseY)
  }

  onMouseReleased = (o: IAppContext) => {
    let targetConnector = this.getHoveredConnector(o)

    if (targetConnector) {
      let connected = this.edge.setEndConnector(targetConnector)
      if (connected) o.edges.push(this.edge)
      else console.warn("Cannot make this connection - action cancelled");

    }

    if (this.hoverConnector) this.hoverConnector.state = EState.idle
    this.ctx.component.state = EState.idle
    this.hoverConnector = null
  }
  additionalDraw = () => this.edge.draw()
}