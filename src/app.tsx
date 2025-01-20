import * as React from 'react'
import * as Tldraw from 'tldraw'

import {
    Vec, VecLike,
    Mat, MatLike,
} from 'tldraw'


const TAU = 6.283185307179586

const min   = Math.min
const max   = Math.max
const floor = Math.floor
const ceil  = Math.ceil
const abs   = Math.abs
const sign  = Math.sign


/**
 * Mutating version of `Tldraw.Mat.applyToPoint`
 */
function transform(vec: VecLike, matrix: MatLike): void {
    let {x, y} = vec
    vec.x = x * matrix.a + y * matrix.c + matrix.e
    vec.y = x * matrix.b + y * matrix.d + matrix.f
}

function ccw_xy(Ax: number, Ay: number, Bx: number, By: number, Cx: number, Cy: number) {
    return (Cy-Ay) * (Bx-Ax) > (By-Ay) * (Cx-Ax)
}

function ccw_segments_intersecting_xy(
    Ax: number, Ay: number,
    Bx: number, By: number,
    Cx: number, Cy: number,
    Dx: number, Dy: number,
) {
    return ccw_xy(Ax, Ay, Cx, Cy, Dx, Dy) !== ccw_xy(Bx, By, Cx, Cy, Dx, Dy) &&
           ccw_xy(Ax, Ay, Bx, By, Cx, Cy) !== ccw_xy(Ax, Ay, Bx, By, Dx, Dy)
}

function within_segment(
    p:  VecLike,
    Ax: number, Ay: number,
    Bx: number, By: number,
) {
    return min(Ax, Bx) <= p.x && p.x <= max(Ax, Bx) &&
           min(Ay, By) <= p.y && p.y <= max(Ay, By)
}

function segments_intersection(
    Ax: number, Ay: number,
    Bx: number, By: number,
    Cx: number, Cy: number,
    Dx: number, Dy: number,
    out: VecLike,
): boolean {

    let mAB = (By-Ay) / (Bx-Ax)
    let mCD = (Dy-Cy) / (Dx-Cx)

    if (mAB === mCD) return false

    out.x = (mAB*Ax - mCD*Cx + Cy - Ay) / (mAB-mCD)
    out.y = mAB * (out.x-Ax) + Ay

    return within_segment(out, Ax, Ay, Bx, By) &&
           within_segment(out, Cx, Cy, Dx, Dy)
}

export function get_x_on_segment(
    x1: number, y1: number,
    x2: number, y2: number,
    y: number
): number {
    return x1 + (y-y1) / (y2-y1) * (x2-x1)
}

export function get_y_on_segment(
    x1: number, y1: number,
    x2: number, y2: number,
    x: number
): number {
    return y1 + (x-x1) / (x2-x1) * (y2-y1)
}


type Union<T> = {[K in keyof T]: UnionMember<T, K>}[keyof T]

type UnionMember<T, K extends keyof T> = {kind: K, data: T[K]}


type Shapes = {
    draw:      Tldraw.TLDrawShape
    arrow:     Tldraw.TLArrowShape
    geo:       Tldraw.TLGeoShape
    frame:     Tldraw.TLFrameShape
    embed:     Tldraw.TLEmbedShape
    group:     Tldraw.TLGroupShape
    highlight: Tldraw.TLHighlightShape
    image:     Tldraw.TLImageShape
    line:      Tldraw.TLLineShape
    note:      Tldraw.TLNoteShape
    video:     Tldraw.TLVideoShape
}
type Shape = Union<Shapes>

function getShape(shape: Tldraw.TLShape): Shape {
    return {kind: shape.type, data: shape} as any
}

type AsciiMatrix = number[]

const CHAR_V        = '│'
const CHAR_H        = '─'
const CHAR_VH_CROSS = '┼'
const CHAR_D_TL_BR  = '╲'
const CHAR_D_TR_BL  = '╱'
const CHAR_D_CROSS  = '╳'
const CHAR_A_B_R    = '╭'
const CHAR_A_B_L    = '╮'
const CHAR_A_T_L    = '╯'
const CHAR_A_T_R    = '╰'


function drawGeometryAscii(
    ctx:        CanvasRenderingContext2D,
    editor:     Tldraw.Editor,
    shape:      Tldraw.TLShape | Tldraw.TLShapeId,
    camera_mat: MatLike,
    cell_size:  VecLike,
    grid_pos:   VecLike,
    grid_cells:  VecLike,
    matrix:     AsciiMatrix,
) {

    let geometry = editor.getShapeGeometry(shape)
    let mat = editor.getShapePageTransform(shape)

    if (geometry.vertices.length <= 1) {
        console.log('single vertex')
        return
    }

    // ctx.strokeStyle = theme[shape.data.props.color].solid
    // if (shape.data.props.fill !== 'none' && shape.data.props.isClosed) {
    //     ctx.fillStyle = theme[shape.data.props.color].semi
    //     ctx.fill()
    // }

    let v         = new Vec
    let cell      = new Vec
    let prev_v    = new Vec
    let prev_cell = new Vec

    for (let vi = 0; vi < geometry.vertices.length; vi++) {

        prev_v.setTo(v)
        prev_cell.setTo(cell)

        v.setTo(geometry.vertices[vi])
        transform(v, mat)
        transform(v, camera_mat)

        cell.x = floor((v.x-grid_pos.x) / cell_size.x)
        cell.y = floor((v.y-grid_pos.y) / cell_size.y)

        if (cell.equals(prev_cell)) {
            v.setTo(prev_v)
            cell.setTo(prev_cell)
            continue
        }

        {
            ctx.beginPath()
            ctx.arc(v.x, v.y, camera_mat.a, 0, TAU)
            ctx.fillStyle = 'rgb(0, 0, 255)'
            ctx.fill()
        }

        if (vi === 0)
            continue

        let char = '+'
        let dx = prev_v.x-v.x
        let dy = prev_v.y-v.y
        let adx = abs(dx)
        let ady = abs(dy)
        let sdx = sign(dx)
        let sdy = sign(dy)
        let ad  = abs(adx-ady)

        let cx = prev_cell.x
        let cy = prev_cell.y

        let dcx = 0
        let dcy = 0

        let _i = 0
        for (;;) {

            if (_i++ > 1000) {
                debugger
            }

            let prev_dcx = dcx
            let prev_dcy = dcy

            dcx = sign(cell.x-cx)
            dcy = sign(cell.y-cy)

            let next_cx = cx
            let next_cy = cy

            /* End */
            if (dcx === 0 && dcy === 0) {

                if (cx >= 0 && cx < grid_cells.x &&
                    cy >= 0 && cy < grid_cells.y
                ) {
                    matrix[cx + cy*grid_cells.x] = char
                }

                break
            }

            let mx = cell_size.x * 0.2
            let my = cell_size.y * 0.2

            let cell_x = grid_pos.x + cx * cell_size.x
            let cell_y = grid_pos.y + cy * cell_size.y

            /* Diagonal */
            if (ad < adx && ad < ady) {

                char = sdx === sdy ? '\\' : '/'

                /* Directly Vertical */
                if (dcx === 0 || (
                    dcy !== 0 && ccw_segments_intersecting_xy(
                        prev_v.x, prev_v.y,
                        v.x, v.y,
                        cell_x + mx,               cell_y + max(0, dcy) * cell_size.y,
                        cell_x + cell_size.x - mx, cell_y + max(0, dcy) * cell_size.y,
                    ))
                ) {
                    next_cy += dcy
                }
                /* Directly Horizontal */
                else if (dcx === 0 ||
                    (dcx !== 0 && ccw_segments_intersecting_xy(
                        prev_v.x, prev_v.y,
                        v.x, v.y,
                        cell_x + max(0, dcx) * cell_size.x, cell_y + my,
                        cell_x + max(0, dcx) * cell_size.x, cell_y + cell_size.y - my,
                    ))
                ) {
                    next_cx += dcx
                } else {
                    next_cx += dcx
                    next_cy += dcy
                }
            }
            /* Horizontal */
            else if (adx > ady) {

                if (dcx === 0 ||
                    (dcy !== 0 && ccw_segments_intersecting_xy(
                        prev_v.x, prev_v.y,
                        v.x, v.y,
                        cell_x,               cell_y + max(0, dcy) * cell_size.y,
                        cell_x + cell_size.x, cell_y + max(0, dcy) * cell_size.y,
                    ))
                ) {
                    char = dcx === dcy ? '\\' : '/'
                    next_cx += dcx
                    next_cy += dcy
                }
                else {
                    if (prev_dcy !== 0) {
                        char = prev_dcx === prev_dcy ? '\\' : '/'
                    } else {
                        char = '―'
                    }
                    next_cx += dcx
                }
            }
            /* Vertical */
            else {
                if (dcy === 0 ||
                    (dcx !== 0 && ccw_segments_intersecting_xy(
                        prev_v.x, prev_v.y,
                        v.x, v.y,
                        cell_x + max(0, dcx) * cell_size.x, cell_y,
                        cell_x + max(0, dcx) * cell_size.x, cell_y + cell_size.y,
                    ))
                ) {
                    char = dcx === dcy ? '\\' : '/'
                    next_cx += dcx
                    next_cy += dcy
                }
                else {
                    if (prev_dcx !== 0) {
                        char = prev_dcx === prev_dcy ? '\\' : '/'
                    } else {
                        char = '|'
                    }
                    next_cy += dcy
                }
            }

            if (cx >= 0 && cx < grid_cells.x &&
                cy >= 0 && cy < grid_cells.y
            ) {
                matrix[cx + cy*grid_cells.x] = char
            }

            cx = next_cx
            cy = next_cy
        }
    }
}

function get_char_from_vec(d: VecLike): string {

    let ax = abs(d.x)
    let ay = abs(d.y)
    let ad = abs(ax-ay)

    if (ad < ax && ad < ay) {
        return sign(d.x) === sign(d.y) ? '\\' : '/'
    }
    if (ax > ay) {
        return '─'
    }
    return '│'
}

function drawGeometryAscii2(
    ctx:         CanvasRenderingContext2D,
    editor:      Tldraw.Editor,
    shape:       Tldraw.TLShape | Tldraw.TLShapeId,
    camera_mat:  MatLike,
    cell_size:   VecLike,
    grid_pos:    VecLike,
    grid_cells:  VecLike,
    matrix:      AsciiMatrix,
) {

    let cell_hypot = Math.hypot(cell_size.x/2, cell_size.y/2)

    let geometry = editor.getShapeGeometry(shape)
    let mat = editor.getShapePageTransform(shape)

    if (geometry.vertices.length <= 1) {
        console.log('single vertex')
        return
    }

    let v              = new Vec
    let cell           = new Vec
    let prev_v         = new Vec
    let prev_cell      = new Vec

    type PathItem = {
        c:   Vec,
        d:   Vec,
        key: boolean,
    }

    let path: PathItem[] = []

    for (let vi = 0; vi < geometry.vertices.length; vi++) {

        prev_v.setTo(v)
        prev_cell.setTo(cell)

        v.setTo(geometry.vertices[vi])
        transform(v, mat)
        transform(v, camera_mat)

        cell.x = floor((v.x-grid_pos.x) / cell_size.x)
        cell.y = floor((v.y-grid_pos.y) / cell_size.y)

        if (vi === 0)
            continue

        if (cell.equals(prev_cell)) {
            v.setTo(prev_v)
            cell.setTo(prev_cell)
            continue
        }

        let d = new Vec(prev_v.x-v.x, prev_v.y-v.y)

        let ax = abs(d.x)
        let ay = abs(d.y)
        let ad = abs(ax-ay)

        let is_diagonal = ad < ax && ad < ay

        /* Eliminate points in diagonal strokes that barely touch a cell */
        if (is_diagonal && vi < geometry.vertices.length-1) {
            let cell_x = grid_pos.x + cell.x * cell_size.x + cell_size.x/2
            let cell_y = grid_pos.y + cell.y * cell_size.y + cell_size.y/2
            let dist_to_cell = Vec.Dist(v, {x: cell_x, y: cell_y})
            if (dist_to_cell > cell_hypot*0.8) {
                v.setTo(prev_v)
                cell.setTo(prev_cell)
                continue
            }
        }

        {
            ctx.beginPath()
            ctx.arc(v.x, v.y, camera_mat.a, 0, TAU)
            ctx.fillStyle = 'rgb(0, 0, 255)'
            ctx.fill()
        }

        let cx = prev_cell.x
        let cy = prev_cell.y

        let dcx = 0
        let dcy = 0

        let _i = 0
        for (;;) {

            DEV: if (_i++ > 1000) {
                debugger
            }

            dcx = sign(cell.x-cx)
            dcy = sign(cell.y-cy)

            if (path.length === 0 || !path[path.length-1].c.equalsXY(cx, cy)) {
                path.push({c: new Vec(cx, cy), d, key: dcx === 0 && dcy === 0})
            }

            let cell_x = grid_pos.x + cx * cell_size.x
            let cell_y = grid_pos.y + cy * cell_size.y

            /* End */
            if (dcx === 0 && dcy === 0) {
                break
            }
            /* Horizontal */
            else if (dcy === 0 || (dcx !== 0 && ccw_segments_intersecting_xy(
                prev_v.x, prev_v.y,
                v.x, v.y,
                cell_x + max(0, dcx) * cell_size.x, cell_y,
                cell_x + max(0, dcx) * cell_size.x, cell_y + cell_size.y,
            ))) {
                cx += dcx
            }
            /* Vertical */
            else {
                cy += dcy
            }
        }
    }

    if (path.length <= 1)
        return

    for (let i = 0; i < path.length; i++) {
        let item = path[i]

        // let char = get_char_from_vec(item.d)

        let char: string
        {
            let sx = item.c.x
            let sy = item.c.y
            let ex = item.c.x
            let ey = item.c.y
            if (i+1 < path.length) {
                ex = path[i+1].c.x
                ey = path[i+1].c.y
            }
            if (i > 0) {
                sx = path[i-1].c.x
                sy = path[i-1].c.y
            }

            let dx = ex-sx
            let dy = ey-sy
            let ax = abs(dx)
            let ay = abs(dy)
            let ad = abs(ax-ay)

            if (ad < ax && ad < ay) {
                char =  sign(dx) === sign(dy) ? CHAR_D_TL_BR : CHAR_D_TR_BL
            } else if (ax > ay) {
                char =  CHAR_H
            } else {
                char =  CHAR_V
            }
        }


        if (i > 0 && i < path.length-1) {
            let prev = path[i-1]
            let next = path[i+1]

            let prev_dcx = item.c.x-prev.c.x
            let prev_dcy = item.c.y-prev.c.y
            let next_dcx = item.c.x-next.c.x
            let next_dcy = item.c.y-next.c.y


            /*
             Eliminate/smooth corners

             |           |
             |――    ->    ――

            */
            if (abs(prev_dcx)+abs(next_dcx) === 1 &&
                abs(prev_dcy)+abs(next_dcy) === 1
            ) {
                if (item.key) {
                    char = prev_dcx === next_dcy && prev_dcy === next_dcx
                        ? (prev_dcx > 0 || prev_dcy > 0 ? CHAR_A_T_L : CHAR_A_B_R)
                        : (prev_dcx > 0 || next_dcx > 0 ? CHAR_A_B_L : CHAR_A_T_R)
                } else {
                    path.splice(i, 1)
                    i-=2 // redo prev
                    continue
                }
            }
            /*
             Smooth diagonal-straight connection

              ――          ―-
                ――   ->     \―

            */
            else if (abs(prev_dcx)+abs(prev_dcy)+abs(next_dcx)+abs(next_dcy) === 3) {
                char = sign(item.d.x) === sign(item.d.y) ? CHAR_D_TL_BR : CHAR_D_TR_BL
            }
        }

        if (item.c.x >= 0 && item.c.x < grid_cells.x &&
            item.c.y >= 0 && item.c.y < grid_cells.y
        ) {
            let old_char = matrix[item.c.x + item.c.y*grid_cells.x]
            if (old_char) {
                if ((old_char === CHAR_V && char === CHAR_H) ||
                    (old_char === CHAR_H && char === CHAR_V)
                ) {
                    char = CHAR_VH_CROSS
                }
            }
            matrix[item.c.x + item.c.y*grid_cells.x] = char
        }
    }

    /* Close some paths */
    if (path.length >= 3) {

        let prev = path[0]
        let last = path[path.length-1]
        let next = path[path.length-2]

        let prev_dcx = last.c.x-prev.c.x
        let prev_dcy = last.c.y-prev.c.y
        let next_dcx = last.c.x-next.c.x
        let next_dcy = last.c.y-next.c.y

        if (abs(prev_dcx)+abs(next_dcx) === 1 &&
            abs(prev_dcy)+abs(next_dcy) === 1
        ) {
            let char = prev_dcx === next_dcy && prev_dcy === next_dcx
                ? (prev_dcx > 0 || prev_dcy > 0 ? CHAR_A_T_L : CHAR_A_B_R)
                : (prev_dcx > 0 || next_dcx > 0 ? CHAR_A_B_L : CHAR_A_T_R)

            if (last.c.x >= 0 && last.c.x < grid_cells.x &&
                last.c.y >= 0 && last.c.y < grid_cells.y
            ) {
                matrix[last.c.x + last.c.y*grid_cells.x] = char
            }
        }
    }
}

/*
|   ▁▁▁▁▁▁▁▁▁
|   |╲ ╱|╲ ╱|   1 char   ==   20 edges
|   | ╳ | ╳ |
|   |╱ ╲|╱ ╲|    ┊ 0┊ 1┊ 2┊ 3┊ 4┊
|   ━━━━━━━━━    ┊▎ ┊▔ ┊ ▔┊ 🮈┊  ┊
|   |╲ ╱|╲ ╱|    ┊  ┊  ┊  ┊  ┊ 🮈┊
|   | ╳ | ╳ |    ┊ 5┊ 6┊ 7┊ 8┊ 9┊
|   |╱ ╲|╱ ╲|    ┊  ┊  ┊  ┊ ▎┊  ┊
|   ▔▔▔▔▔▔▔▔▔    ┊ ▁┊▁ ┊▎ ┊  ┊ ▎┊
|                ┊10┊11┊12┊13┊14┊
|                ┊  ┊  ┊╲ ┊╱ ┊ ╲┊
|                ┊▔ ┊ ▔┊  ┊  ┊  ┊
|                ┊15┊16┊17┊18┊19┊
|                ┊ ╱┊  ┊  ┊  ┊  ┊
|                ┊  ┊╲ ┊╱ ┊ ╲┊ ╱┊
*/

function placement_hash(ax: number, ay: number, bx: number, by: number): number {
    return (1<<(ax + ay*3)) | (1<<(bx + by*3))
}

const points_table: Readonly<Record<number, number>> = {
    // single
    [placement_hash(0, 0, 0, 1)]: 1<<0,
    [placement_hash(0, 0, 1, 0)]: 1<<1,
    [placement_hash(1, 0, 2, 0)]: 1<<2,
    [placement_hash(2, 0, 2, 1)]: 1<<3,
    [placement_hash(2, 1, 2, 2)]: 1<<4,
    [placement_hash(1, 2, 2, 2)]: 1<<5,
    [placement_hash(0, 2, 1, 2)]: 1<<6,
    [placement_hash(0, 1, 0, 2)]: 1<<7,
    [placement_hash(1, 0, 1, 1)]: 1<<8,
    [placement_hash(1, 1, 1, 2)]: 1<<9,
    [placement_hash(0, 1, 1, 1)]: 1<<10,
    [placement_hash(1, 1, 2, 1)]: 1<<11,
    [placement_hash(0, 0, 1, 1)]: 1<<12,
    [placement_hash(1, 0, 0, 1)]: 1<<13,
    [placement_hash(1, 0, 2, 1)]: 1<<14,
    [placement_hash(2, 0, 1, 1)]: 1<<15,
    [placement_hash(0, 1, 1, 2)]: 1<<16,
    [placement_hash(1, 1, 0, 2)]: 1<<17,
    [placement_hash(1, 1, 2, 2)]: 1<<18,
    [placement_hash(2, 1, 1, 2)]: 1<<19,
    // diagonal
    [placement_hash(0, 0, 2, 2)]: 1<<12 | 1<<18,
    [placement_hash(2, 0, 0, 2)]: 1<<15 | 1<<17,
    // straight
    [placement_hash(2, 0, 2, 2)]: 1<<3  | 1<<4,
    [placement_hash(0, 0, 0, 2)]: 1<<0  | 1<<7,
    [placement_hash(0, 0, 2, 0)]: 1<<1  | 1<<2,
    [placement_hash(0, 2, 2, 2)]: 1<<5  | 1<<6,
    [placement_hash(0, 1, 2, 1)]: 1<<10 | 1<<11,
    [placement_hash(1, 0, 1, 2)]: 1<<8  | 1<<9,
    // extra
    [placement_hash(0, 0, 1, 2)]: 1<<12 | 1<<9,
    [placement_hash(2, 0, 1, 2)]: 1<<15 | 1<<9,
    [placement_hash(1, 0, 2, 2)]: 1<<8  | 1<<18,
    [placement_hash(1, 0, 0, 2)]: 1<<8  | 1<<17,
    [placement_hash(0, 1, 2, 0)]: 1<<10 | 1<<15,
    [placement_hash(0, 1, 2, 2)]: 1<<10 | 1<<18,
    [placement_hash(2, 1, 0, 0)]: 1<<11 | 1<<12,
    [placement_hash(2, 1, 0, 2)]: 1<<11 | 1<<17,
}

function points_to_char(points: number): string | null {

    /* ▎▔▕▁  ╱╲╳ */
    switch (points) {
    case 1<<0:                return '▏'
    case 1<<1:                return '▔'
    case 1<<2:                return '▔'
    case 1<<2 | 1<<1:         return '▔'
    case 1<<3:                return '▕'
    case 1<<4:                return '▕'
    case 1<<3 | 1<<4:         return '▕'
    case 1<<5:                return '▁'
    case 1<<6:                return '▁'
    case 1<<5 | 1<<6:         return '▁'
    case 1<<7:                return '▏'
    case 1<<0 | 1<<7:         return '▏'
    case 1<<8:                return '│'
    case 1<<9:                return '│'
    case 1<<8 | 1<<9:         return '│'
    case 1<<10:               return '─'
    case 1<<11:               return '─'
    case 1<<10 | 1<<11:       return '─'
    case 1<<13:               return '🮠'
    case 1<<14:               return '🮡'
    case 1<<16:               return '🮢'
    case 1<<19:               return '🮣'
    case 1<<12 | 1<<18:       return '╲'
    case 1<<15 | 1<<17:       return '╱'
    case 1<<13 | 1<<19:       return '🮨'
    case 1<<16 | 1<<16:       return '🮩'
    case 1<<9  | 1<<10:       return '╮'
    case 1<<9  | 1<<11:       return '╭'
    case 1<<8  | 1<<10:       return '╯'
    case 1<<8  | 1<<11:       return '╰'
    case 1<<1  | 1<<8 | 1<<9: return '˥'
    case 1<<6  | 1<<8 | 1<<9: return '˩'
    }

    // Multiple points - return cross or intersection
    let has_horizontal     = points & (1<<10 | 1<<11)
    let has_vertical       = points & (1<<8 | 1<<9)
    let has_horizontal_top = points & (1<<1 | 1<<2)
    let has_horizontal_bot = points & (1<<5 | 1<<6) 
    let has_diagonal_left  = points & (1<<12 | 1<<14 | 1<<16 | 1<<18)
    let has_diagonal_right = points & (1<<13 | 1<<15 | 1<<17 | 1<<19)

    if (has_horizontal && has_vertical) return '┼'
    if (has_diagonal_left && has_diagonal_right) return '╳'
    if (has_horizontal || has_horizontal_top || has_horizontal_bot) return '─'
    if (has_vertical) return '│'
    if (has_diagonal_left) return '╲'
    if (has_diagonal_right) return '╱'
    return null
}

type DrawCtx = {
    ctx:         CanvasRenderingContext2D,
    editor:      Tldraw.Editor,
    camera_mat:  MatLike,
    cell_size:   VecLike,
    grid_pos:    VecLike,
    grid_cells:  VecLike,
    matrix:      AsciiMatrix,
}

function placement_from_pos(
    ctx: DrawCtx,
     x: number,  y: number,
): number {

    x = Math.ceil((x - ctx.grid_pos.x + ctx.cell_size.x/2) / ctx.cell_size.x/2)
    y = Math.ceil((y - ctx.grid_pos.y + ctx.cell_size.y/2) / ctx.cell_size.y/2)

    return x + y*ctx.grid_cells.x*2
}

function drawGeometryAscii3(
    ctx:         CanvasRenderingContext2D,
    editor:      Tldraw.Editor,
    camera_mat:  MatLike,
    cell_size:   VecLike,
    grid_pos:    VecLike,
    grid_cells:  VecLike,
    matrix:      AsciiMatrix,
    shape: Tldraw.TLShape | Tldraw.TLShapeId,
) {

    let geometry = editor.getShapeGeometry(shape)
    let mat      = editor.getShapePageTransform(shape)

    if (geometry.vertices.length <= 1) {
        console.log('single vertex')
        return
    }

    let v         = new Vec
    let cell      = new Vec
    let prev_v    = new Vec
    let prev_cell = new Vec

    let last_px   = -1
    let last_py   = -1

    function add_placement(x: number, y: number) {

        let px = floor((x - grid_pos.x + cell_size.x/4) / (cell_size.x/2))
        let py = floor((y - grid_pos.y + cell_size.y/4) / (cell_size.y/2))

        let cx = floor(min(last_px, px) / 2)
        let cy = floor(min(last_py, py) / 2)

        if (last_px !== -1 && last_py !== -1 &&
            (last_px !== px || last_py !== py) &&
            cx >= 0 && cx < grid_cells.x &&
            cy >= 0 && cy < grid_cells.y
        ) {
            let s = placement_hash(last_px - cx*2, last_py - cy*2, px - cx*2, py - cy*2)

            console.assert(s in points_table)

            matrix[cx + cy*grid_cells.x] = points_table[s]
        }

        _dot_pos.x = px * cell_size.x/2 + grid_pos.x
        _dot_pos.y = py * cell_size.y/2 + grid_pos.y

        path_placement.moveTo(_dot_pos.x, _dot_pos.y)
        path_placement.arc(_dot_pos.x, _dot_pos.y, camera_mat.a, 0, TAU)

        path_lines.lineTo(_dot_pos.x, _dot_pos.y)

        last_px = px
        last_py = py
    }

    let path_lines = new Path2D
    let path_placement = new Path2D
    let path_cut = new Path2D

    let _dot_pos = new Vec

    for (let vi = 0; vi < geometry.vertices.length; vi++) {

        prev_v.setTo(v)
        prev_cell.setTo(cell)

        v.setTo(geometry.vertices[vi])
        transform(v, mat)
        transform(v, camera_mat)

        cell.x = floor((v.x-grid_pos.x) / cell_size.x)
        cell.y = floor((v.y-grid_pos.y) / cell_size.y)

        if (vi === 0) {
            add_placement(v.x, v.y)
            continue
        }

        let cx = prev_cell.x
        let cy = prev_cell.y

        for (;;) {

            let dcx = sign(cell.x-cx)
            let dcy = sign(cell.y-cy)

            let cell_x = grid_pos.x + cx * cell_size.x
            let cell_y = grid_pos.y + cy * cell_size.y

            let cut_x = cell_x + max(0, dcx) * cell_size.x
            let cut_y = cell_y + max(0, dcy) * cell_size.y

            /* End */
            if (dcx === 0 && dcy === 0) {
                break
            }
            /* Horizontal */
            else if (dcy === 0 || (dcx !== 0 && ccw_segments_intersecting_xy(
                prev_v.x, prev_v.y,
                v.x, v.y,
                cut_x, cell_y,
                cut_x, cell_y + cell_size.y,
            ))) {
                cx += dcx

                cut_y = get_y_on_segment(
                    prev_v.x, prev_v.y,
                    v.x, v.y,
                    cut_x,
                )
            }
            /* Vertical */
            else {
                cy += dcy

                cut_x = get_x_on_segment(
                    prev_v.x, prev_v.y,
                    v.x, v.y,
                    cut_y,
                )
            }

            path_cut.moveTo(cut_x, cut_y)
            path_cut.arc(cut_x, cut_y, camera_mat.a*0.8, 0, TAU)

            add_placement(cut_x, cut_y)
        }

        add_placement(v.x, v.y)
    }

    ctx.strokeStyle = 'rgb(0, 0, 255)'
    ctx.stroke(path_lines)

    ctx.fillStyle = 'rgb(0, 200, 59)'
    ctx.fill(path_placement)

    ctx.fillStyle = 'rgb(240, 20, 59)'
    ctx.fill(path_cut)
}

function CustomBackground(): React.ReactNode {

	const editor = Tldraw.useEditor()
	const rCanvas = React.useRef<HTMLCanvasElement>(null)

	React.useLayoutEffect(() => {

		const canvas = rCanvas.current
		if (!canvas) return

		canvas.style.width  = '100%'
		canvas.style.height = '100%'

		const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false


        let dpr = 1
        let font_size = new Vec(16, 12)
        let window_size = new Vec()

		let raf = 0

        let measure_time = 0
        let resized = true

        const onResize = () => {resized = true}


        let _vec = new Vec // reuse object

        function drawGeometry(
            vertices: VecLike[],
            camera:   MatLike,
            mat:      MatLike,
            close:    boolean,
        ) {
            if (vertices.length > 1) {
                _vec.setTo(vertices[0])
                transform(_vec, mat)
                transform(_vec, camera)
                ctx.moveTo(_vec.x, _vec.y)
                for (let i = 1; i < vertices.length; i++) {
                    _vec.setTo(vertices[i])
                    transform(_vec, mat)
                    transform(_vec, camera)
                    ctx.lineTo(_vec.x, _vec.y)
                }
                if (close) {
                    _vec.setTo(vertices[0])
                    transform(_vec, mat)
                    transform(_vec, camera)
                    ctx.lineTo(_vec.x, _vec.y)
                }
            }
        }

		const render = (time: number) => {

            let needs_remeasure = time-measure_time > 4000 || resized

            if (needs_remeasure) {
                measure_time = time
                resized = false

                dpr = Tldraw.clamp(window.devicePixelRatio, 1, 2)

                window_size.x = window.innerWidth
                window_size.y = window.innerHeight

                canvas.width  = (window_size.x * dpr)|0
                canvas.height = (window_size.y * dpr)|0
            }

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.clearRect(0, 0, window_size.x, window_size.y)

            if (needs_remeasure) {
                font_size.y = parseFloat(window.getComputedStyle(document.body).fontSize)
                ctx.font = font_size.y+'px monospace'
                font_size.x = ctx.measureText('M').width
            }

            let page_rect = editor.getViewportPageBounds()
            let camera = editor.getCamera()

            let cell_size = new Vec(font_size.x*camera.z, font_size.y*camera.z)

            // cols x rows
            let grid_cells = new Vec(
                ceil(page_rect.w/font_size.x) + 1,
                ceil(page_rect.h/font_size.y) + 1,
            )

            let grid_pos = new Vec(
                (-font_size.x -(page_rect.x%font_size.x)) * camera.z,
                (-font_size.y -(page_rect.y%font_size.y)) * camera.z,
            )

            /*
             render grid lines
            */
            let line_width = min(2, camera.z/1.8 - 0.3)
            if (line_width > 0.1) {

                ctx.beginPath()
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)'
                ctx.lineWidth = line_width


                // vertical lines
                for (let i = 0; i <= grid_cells.x; i++) {
                    ctx.moveTo(grid_pos.x + i*cell_size.x, 0)
                    ctx.lineTo(grid_pos.x + i*cell_size.x, cell_size.y*grid_cells.y)
                }

                // horizontal lines
                for (let i = 0; i <= grid_cells.y; i++) {
                    ctx.moveTo(0,                grid_pos.y + i*cell_size.y)
                    ctx.lineTo(cell_size.x*grid_cells.x, grid_pos.y + i*cell_size.y)
                }

                ctx.stroke()
            }

            let matrix: AsciiMatrix = new Array(grid_cells.y*grid_cells.x)

            // draw rows and cols count in bottom right corner
            ctx.font = '16px monospace'
            ctx.fillStyle = 'rgba(128, 128, 128, 0.6)'
            let text = `${grid_cells.y}×${grid_cells.x}`
            let metrics = ctx.measureText(text)
            ctx.fillText(text, window_size.x - metrics.width - 100, window_size.y - 100)

            let camera_mat = new Mat(
                camera.z, 0, 0,
                camera.z, camera.x*camera.z, camera.y*camera.z,
            )

			let shapes = editor.getRenderingShapes()
			let theme = Tldraw.getDefaultColorTheme({isDarkMode: editor.user.getIsDarkMode()})


			for (let rendering_shape of shapes) {
                let shape = getShape(rendering_shape.shape)

                switch (shape.kind) {
                case 'draw': {

                    drawGeometryAscii3(
                        ctx,
                        editor,
                        camera_mat,
                        cell_size,
                        grid_pos,
                        grid_cells,
                        matrix,
                        shape.data,
                    )

                    break
                }
                case 'arrow': {

                    drawGeometryAscii3(
                        ctx,
                        editor,
                        camera_mat,
                        cell_size,
                        grid_pos,
                        grid_cells,
                        matrix,
                        shape.data,
                    )

                    break
                }
                case 'geo': {

                    drawGeometryAscii3(
                        ctx,
                        editor,
                        camera_mat,
                        cell_size,
                        grid_pos,
                        grid_cells,
                        matrix,
                        shape.data,
                    )

                    break
                }
                case 'line': {

                    drawGeometryAscii3(
                        ctx,
                        editor,
                        camera_mat,
                        cell_size,
                        grid_pos,
                        grid_cells,
                        matrix,
                        shape.data,
                    )

                    break
                }
                case 'frame':
                case 'embed':
                case 'group':
                case 'highlight':
                case 'image':
                case 'note':
                case 'video': {
                    break
                }
                default: {
                    shape satisfies never
                }
                }
			}

            ctx.font = cell_size.y+'px monospace'
            ctx.fillStyle = 'black'

            for (let y = 0; y < grid_cells.y; y++) {
            for (let x = 0; x < grid_cells.x; x++) {
                let idx = x + y*grid_cells.x
                if (idx in matrix) {
                    let char = points_to_char(matrix[idx])
                    if (char != null) {
                        ctx.fillText(
                            char,
                            grid_pos.x + x * cell_size.x,
                            grid_pos.y + (y+1) * cell_size.y)
                    }
                }
            }
            }

			raf = requestAnimationFrame(render)
		}

		requestAnimationFrame(render)

        window.addEventListener('resize', onResize)

		return () => {
			cancelAnimationFrame(raf)
            window.removeEventListener('resize', onResize)
		}
	}, [editor])

	return <canvas ref={rCanvas} />
}

function CustomShapeIndicator(props: Tldraw.TLShapeIndicatorProps): React.ReactNode {

    console.log('CustomShapeIndicator', props)

    return <></>
}

export function App() {
	return (
		<div className="tldraw__editor">
			<Tldraw.Tldraw
				persistenceKey="asciidraw"
				components={{
                    Background: CustomBackground,
                    // ShapeIndicator: CustomShapeIndicator,
                }}
			/>
		</div>
	)
}
