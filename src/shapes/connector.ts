import p5 from 'p5'
import Shape, { IShape } from './shape'
import { EColors } from '../colors'
import { app as p } from '../index'

export default class Connector extends Shape implements IShape {
  radius: number = 10
  nameOffset: number = 0

  constructor(pos: p5.Vector, name: string) {
    super(pos, name)

    // Override
    this.backgroundColor = p.color(EColors.silver)
  }

  draw = () => {
    p.fill(p.color(this.backgroundColor))
    p.strokeWeight(this.strokeWeight)
    p.stroke(this.borderColor)
    p.ellipse(this.pos.x, this.pos.y, this.radius, this.radius)

    p.fill(this.borderColor)
    p.noStroke()
    p.text(this.name, this.pos.x + this.nameOffset, this.pos.y)
  }

  collide = (x: number, y: number): Shape => {
    if (p.sqrt(p.sq(y - this.pos.y) + p.sq(x - this.pos.x)) <= this.radius + this.strokeWeight)
      return this
  }
}

export class InputConnector extends Connector {
  constructor(pos: p5.Vector, name: string) {
    super(pos, name)
    this.nameOffset = 10
  }
}

export class OutputConnector extends Connector {
  constructor(pos: p5.Vector, name: string) {
    super(pos, name)
    this.nameOffset = -10
  }
}