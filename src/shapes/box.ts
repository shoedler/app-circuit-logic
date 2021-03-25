import p5 from "p5"
import Shape, { IShape, ShapeOffset } from "./shape"
import Connector, { InputConnector, OutputConnector } from "./connector"
import { app as p } from "../index"

export default class Box extends Shape implements IShape {
  width: number
  height: number

  constructor(pos: p5.Vector, name: string, width: number, height: number) {
    super(pos, name)
    this.width = width
    this.height = height
  }

  draw = () => {
    // Base rectangle
    p.fill(this.backgroundColor)
    p.stroke(this.borderColor)
    p.strokeWeight(this.strokeWeight)
    p.rect(this.pos.x, this.pos.y, this.width, this.height)

    // Name tag
    p.textSize(30)
    p.textAlign(p.CENTER, p.CENTER)
    p.fill(this.borderColor)
    p.noStroke()
    p.text(this.name, this.pos.x + this.width / 2, this.pos.y + this.height / 2)
  }

  collide = (x: number, y: number): Box => {
    if ((x > this.pos.x && x < this.pos.x + this.width) && (y > this.pos.y && y < this.pos.y + this.height))
      return this
  }

}