import p5 from "p5";
import { EColors } from "../colors";
import { app as p } from "../index";
import { EState } from "../state";

export interface ShapeOffset {
  x: number
  y: number
}

export default class Shape {
  pos: p5.Vector
  name: string

  borderColor: p5.Color
  backgroundColor: p5.Color
  strokeWeight: number

  constructor(pos: p5.Vector, name: string) {
    this.pos = pos
    this.name = name
    this.borderColor = p.color(EColors.wetAsphalt)
    this.backgroundColor = p.color(EColors.emerald)
    this.strokeWeight = 2;
    this._state = EState.idle
  }

  private _state: EState;
  public get state(): EState {
    return this._state;
  }
  public set state(v: EState) {
    this._state = v;
    switch (this._state) {
      case EState.idle: this.borderColor = p.color(EColors.wetAsphalt); break;
      case EState.selected: this.borderColor = p.color(EColors.carrot); break;
      case EState.log1: this.borderColor = p.color(EColors.sunFlower); break;
      case EState.log0: this.borderColor = p.color(EColors.alizarin); break;
      default: this.borderColor = p.color(EColors.nephritis); break;
    }
  }

  offsets = (x: number, y: number): ShapeOffset => {
    return <ShapeOffset>{ x: x - this.pos.x, y: y - this.pos.y }
  }
}

export interface IShape {
  draw(): void
  collide(x: number, y: number): Shape
}