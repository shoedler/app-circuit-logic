import p5 from "p5"
import { InputConnector, OutputConnector } from "./shapes/connector"
import { app as p } from "./index"
import Box from "./shapes/box"
import { TActionContext } from "./actions"

export default class Gate {
  body: Box
  inputs: InputConnector[]
  outputs: OutputConnector[]

  constructor(pos: p5.Vector, name: string, width: number, height: number, inputNames: string[], outputNames: string[]) {
    this._pos = pos
    this.body = new Box(pos, name, width, height)
    this.inputs = inputNames.map(i => new InputConnector(pos.copy(), i))
    this.outputs = outputNames.map(o => new OutputConnector(pos.copy(), o))
    this.width = width
    this.height = height
  }

  private _height: number;
  public get height(): number {
    return this._height;
  }
  public set height(v: number) {
    this._height = v;
    this.body.height = v
    this.updatePosition()
  }

  private _width: number;
  public get width(): number {
    return this._width;
  }
  public set width(v: number) {
    this._width = v;
    this.body.width = v
    this.updatePosition()
  }

  private _pos: p5.Vector;
  public get pos(): p5.Vector {
    return this._pos;
  }
  public set pos(v: p5.Vector) {
    this._pos = v;
    this.body.pos = this._pos
    this.updatePosition()
  }

  private updatePosition = () => {
    let yPad = this._height * 0.2
    let yInpSpacing = (this._height - 2 * yPad) / (this.inputs.length - 1 || 1)
    let yOupSpacing = (this._height - 2 * yPad) / (this.outputs.length - 1 || 1)

    this.inputs.forEach((inp, i) => {
      inp.pos.x = this._pos.x
      inp.pos.y = this._pos.y + yPad + (yInpSpacing * i)
    })

    this.outputs.forEach((oup, i) => {
      oup.pos.x = this._pos.x + this._width
      oup.pos.y = this._pos.y + yPad + (yOupSpacing * i)
    })
  }

  render = () => {
    this.body.draw()

    p.textSize(15)
    p.textAlign(p.LEFT, p.CENTER)
    this.inputs.forEach(i => i.draw())
    p.textAlign(p.RIGHT, p.CENTER)
    this.outputs.forEach(o => o.draw())
  }

  collides = (x: number, y: number): TActionContext => {
    let inInput = this.inputs.filter(i => i.collide(x, y))[0]
    if (inInput) return { gate: this, component: inInput }
    let inOutput = this.outputs.filter(o => o.collide(x, y))[0]
    if (inOutput) return { gate: this, component: inOutput }
    let inBody = this.body.collide(x, y)
    if (inBody) return { gate: this, component: inBody }
    return null
  }
}

