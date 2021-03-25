import p5 from "p5";
import Edge from "./shapes/edge";
import Gate from "./gate";
import ISimulator, { AndGate, OrGate, Log1Gate, XorGate, CoilGate } from "./simulators";
import { EColors } from "./colors";
import { IAction, getAction, TActionContext } from "./actions";

let action: IAction | null

let buttonSimulate: p5.Element
let buttonAddAndGate: p5.Element
let buttonAddOrGate: p5.Element
let buttonAddXorGate: p5.Element
let buttonAddLog1Gate: p5.Element
let buttonAddCoilGate: p5.Element

let simulate: boolean = false

export interface IAppContext {
  gates: Array<Gate & ISimulator>,
  edges: Array<Edge & ISimulator>,
  getHovered(gates: Array<Gate & ISimulator>): TActionContext
}

const data: IAppContext = {
  gates: [],
  edges: [],
  getHovered(gates: Array<Gate & ISimulator>): TActionContext {
    let element = null
    for (let i = 0; i < gates.length; i++) {
      element = gates[i].collides(app.mouseX, app.mouseY)
      if (element) break;
    }
    return element;
  }
}

const sketch = (p: p5) => {
  p.setup = () => {
    console.log("🚀 - Setup initialized - P5 is running");
    p.createCanvas(window.innerWidth, window.innerHeight);

    // Simulation Button 
    buttonSimulate = p.createButton("Simulate")
    buttonSimulate.position(10, 10)
    buttonSimulate.mouseClicked(() => simulate = !simulate)

    // Add AND Gate Button
    buttonAddAndGate = p.createButton("Add AND Gate")
    buttonAddAndGate.position(10, 35)
    buttonAddAndGate.mouseClicked(() => data.gates.push(new AndGate(p.createVector(200, 100))))

    // Add OR Gate Button
    buttonAddOrGate = p.createButton("Add OR Gate ")
    buttonAddOrGate.position(10, 60)
    buttonAddOrGate.mouseClicked(() => data.gates.push(new OrGate(p.createVector(200, 100))))

    // Add XOR Gate Button
    buttonAddXorGate = p.createButton("Add XOR Gate")
    buttonAddXorGate.position(10, 85)
    buttonAddXorGate.mouseClicked(() => data.gates.push(new XorGate(p.createVector(200, 100))))

    // Add Log1 Gate Button
    buttonAddLog1Gate = p.createButton("Add Log1 Gate")
    buttonAddLog1Gate.position(10, 110)
    buttonAddLog1Gate.mouseClicked(() => data.gates.push(new Log1Gate(p.createVector(200, 100))))

    // Add Coil Gate Button
    buttonAddCoilGate = p.createButton("Add Coil Gate")
    buttonAddCoilGate.position(10, 135)
    buttonAddCoilGate.mouseClicked(() => data.gates.push(new CoilGate(p.createVector(200, 100))))
  }

  p.draw = () => {
    p.background(p.color(EColors.midnightBlue))

    if (action) action.additionalDraw()

    data.edges.forEach(e => e.draw())
    data.gates.forEach(g => g.render())

    if (simulate) {
      data.gates.forEach(g => g.simulate())
      data.edges.forEach(e => e.simulate())
    }

    let statusColor = simulate ? p.color(EColors.emerald) : p.color(EColors.alizarin)
    p.fill(statusColor)
    p.noStroke()
    p.ellipse(80, 20, 15, 15)
  }
}

export const app = new p5(sketch)

app.mousePressed = () => {
  let element: TActionContext = data.getHovered(data.gates)
  action = getAction(element)
  if (action) action.onMousePressed(data)
}
app.mouseDragged = () => action ? action.onMouseDragged(data) : null
app.mouseReleased = () => {
  if (action) action.onMouseReleased(data)
  action = null
}