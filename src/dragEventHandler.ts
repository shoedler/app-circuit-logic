import { Connector } from "./connector";
import { Edge } from "./edge";
import { Gate } from "./gate";

export interface IDragEventHandler {
  onStart: (event: MouseEvent) => any;
  onDrag: (event: MouseEvent) => any;
  onDrop: (event: MouseEvent) => any;
}

export class EdgeDragHandler implements IDragEventHandler {
  private _svg: SVGElement;
  private _currentEdge: Edge;

  constructor(svg: SVGElement) {
    this._svg = svg;
  }

  public onStart = (e: MouseEvent): any => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    console.assert(el instanceof Connector);
    const startConnector = el as Connector;

    if (startConnector.type() === "inputs") {
      startConnector.illegal = true;
      setTimeout(() => (startConnector.illegal = false), 500);
      return;
    }

    this._currentEdge = startConnector.newEdge(this._svg);
    e.preventDefault();
    return false;
  };

  public onDrag = (e: MouseEvent): any => {
    if (this._currentEdge) {
      this._currentEdge.draw({ x: e.clientX, y: e.clientY });

      // Visually show that the edge is valid
      const potentialEndConnector = document.elementFromPoint(
        e.clientX,
        e.clientY
      );

      if (potentialEndConnector instanceof Connector) {
        if (potentialEndConnector.type() === "outputs") {
          this._currentEdge.illegal = true;
          this._currentEdge.legal = false;
        } else if (potentialEndConnector.type() === "inputs") {
          this._currentEdge.illegal = false;
          this._currentEdge.legal = true;
        }
        if (potentialEndConnector.hasConnection(this._currentEdge.start)) {
          this._currentEdge.illegal = true;
          this._currentEdge.legal = false;
        }
      } else {
        this._currentEdge.illegal = false;
        this._currentEdge.legal = false;
      }

      return false;
    }
  };

  public onDrop = (e: MouseEvent): any => {
    if (this._currentEdge) {
      this._currentEdge.illegal = false;
      this._currentEdge.legal = false;

      const potentialEndConnector = document.elementFromPoint(
        e.clientX,
        e.clientY
      );

      if (potentialEndConnector instanceof Connector) {
        if (potentialEndConnector.type() === "outputs") {
          this._currentEdge.dispose();
          return;
        }
        if (potentialEndConnector.hasConnection(this._currentEdge.start)) {
          this._currentEdge.dispose();
          return;
        }

        potentialEndConnector.endEdge(this._currentEdge);
        this._currentEdge.draw(); // Update with the final position
      } else {
        this._currentEdge.dispose();
      }

      this._currentEdge = null;
      e.preventDefault();
      return false;
    }
  };
}

export class GateDragHandler implements IDragEventHandler {
  private _origin: { x: number; y: number };
  private _currentGate: Gate;

  public onStart = (e: MouseEvent): any => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    console.assert(el instanceof Gate || el.classList.contains("gate-label"));
    this._currentGate = el instanceof Gate ? el : (el.parentElement as Gate);

    const style = window.getComputedStyle(this._currentGate, null);

    this._origin = {
      x: parseInt(style.getPropertyValue("left"), 10) - e.clientX,
      y: parseInt(style.getPropertyValue("top"), 10) - e.clientY,
    };
  };

  public onDrag = (e: MouseEvent): any => {
    if (this._currentGate) {
      let left = e.clientX + this._origin.x;
      let top = e.clientY + this._origin.y;

      this._currentGate.style.left = left + "px";
      this._currentGate.style.top = top + "px";

      // Propagating call to redraw, will update the edges
      this._currentGate.redraw();

      e.preventDefault();
      return false;
    }
  };

  public onDrop = (e: MouseEvent): any => {
    const trashbinElement = document.querySelector(".trashbin");
    if (this._currentGate && trashbinElement) {
      const trashbinRect = trashbinElement.getBoundingClientRect();
      if (
        e.clientX >= trashbinRect.left &&
        e.clientX <= trashbinRect.right &&
        e.clientY >= trashbinRect.top &&
        e.clientY <= trashbinRect.bottom
      ) {
        trashbinElement.dispatchEvent(
          new CustomEvent("trashed", { detail: this._currentGate })
        );
      }

      this._currentGate = null;
    } else {
      this.onDrag(e);
    }
  };
}
