import { app as p } from "../index"
import Connector, { InputConnector, OutputConnector } from "./connector"
import Shape, { IShape } from "./shape"

export default class Edge extends Shape implements IShape {
  startConnector: Connector
  endConnector: InputConnector

  constructor(startConnector: Connector) {
    super(p.createVector(0, 0), 'Edge') // Ignore
    this.startConnector = startConnector
    this.endConnector = new Connector(startConnector.pos, 'Edge')
  }

  draw = () => {
    p.stroke(this.borderColor)
    p.strokeWeight(this.strokeWeight)
    p.line(this.startConnector.pos.x, this.startConnector.pos.y, this.endConnector.pos.x, this.endConnector.pos.y)
  }

  collide = (x: number, y: number): Shape => {
    if (true)
      console.error("Not Implemented Exception");
    return this
  }

  trace = (x: number, y: number) => {
    this.endConnector.pos = p.createVector(x, y)
  }

  setEndConnector = (c: Connector): boolean => {
    // If necessary, flip start / end Connector
    if (this.startConnector instanceof OutputConnector) {
      this.endConnector = c
    }
    else {
      let temp = this.startConnector
      this.startConnector = c
      this.endConnector = temp
    }
    return true
  }
}